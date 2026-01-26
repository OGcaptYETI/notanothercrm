/**
 * Filter Service - Handles filter persistence and query building
 */

import { db } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  Query,
  WhereFilterOp,
} from 'firebase/firestore';
import { getFilterField } from './filterFields';
import type { FilterCondition } from '@/components/crm/FilterSidebar';

export interface SavedFilter {
  id: string;
  name: string;
  isPublic: boolean;
  conditions: FilterCondition[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  count?: number;
}

/**
 * Build Firestore query constraints from filter conditions
 */
export function buildFilterConstraints(conditions: FilterCondition[]): any[] {
  const constraints: any[] = [];

  for (const condition of conditions) {
    const field = getFilterField(condition.field);
    if (!field) continue;

    const firestoreField = field.firestoreField;
    const { operator, value } = condition;

    // Handle empty/not empty operators
    if (operator === 'is_empty') {
      constraints.push(where(firestoreField, '==', null));
      continue;
    }
    if (operator === 'is_not_empty') {
      constraints.push(where(firestoreField, '!=', null));
      continue;
    }

    // Skip if no value provided (except for empty checks)
    if (value === '' || value === null || value === undefined) continue;

    // Convert value based on field type
    let queryValue: any = value;
    if (field.type === 'number') {
      queryValue = parseFloat(value);
      if (isNaN(queryValue)) continue;
    } else if (field.type === 'date') {
      queryValue = Timestamp.fromDate(new Date(value));
    }

    // Map operators to Firestore operators
    switch (operator) {
      case 'equals':
        constraints.push(where(firestoreField, '==', queryValue));
        break;
      case 'not_equals':
        constraints.push(where(firestoreField, '!=', queryValue));
        break;
      case 'contains':
        // Firestore doesn't support contains, use array-contains for arrays or skip for strings
        // For text search, we'll need to handle this differently (client-side filter)
        console.warn(`Contains operator not fully supported for field ${firestoreField}`);
        break;
      case 'starts_with':
        // Use range query for starts_with
        constraints.push(where(firestoreField, '>=', queryValue));
        constraints.push(where(firestoreField, '<=', queryValue + '\uf8ff'));
        break;
      case 'greater_than':
        constraints.push(where(firestoreField, '>', queryValue));
        break;
      case 'less_than':
        constraints.push(where(firestoreField, '<', queryValue));
        break;
      case 'in':
        // For multi-select, split comma-separated values
        const values = typeof value === 'string' ? value.split(',').map(v => v.trim()) : [value];
        constraints.push(where(firestoreField, 'in', values));
        break;
      case 'between':
        // Between requires two values - handle this specially
        console.warn(`Between operator requires special handling for field ${firestoreField}`);
        break;
    }
  }

  return constraints;
}

/**
 * Apply client-side filters that Firestore doesn't support natively
 */
export function applyClientSideFilters(
  data: any[],
  conditions: FilterCondition[]
): any[] {
  return data.filter(item => {
    for (const condition of conditions) {
      const field = getFilterField(condition.field);
      if (!field) continue;

      const fieldValue = item[field.firestoreField];
      const { operator, value } = condition;

      // Handle contains operator (not supported by Firestore)
      if (operator === 'contains') {
        if (!fieldValue || typeof fieldValue !== 'string') return false;
        if (!fieldValue.toLowerCase().includes(value.toLowerCase())) return false;
      }
    }
    return true;
  });
}

/**
 * Save a filter to Firestore
 */
export async function saveFilter(
  filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const now = new Date();
  const filterData = {
    ...filter,
    createdBy: userId,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };

  const docRef = await addDoc(collection(db, 'saved_filters'), filterData);
  return docRef.id;
}

/**
 * Update an existing filter
 */
export async function updateFilter(
  filterId: string,
  updates: Partial<SavedFilter>
): Promise<void> {
  const filterRef = doc(db, 'saved_filters', filterId);
  await updateDoc(filterRef, {
    ...updates,
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

/**
 * Delete a filter
 */
export async function deleteFilter(filterId: string): Promise<void> {
  const filterRef = doc(db, 'saved_filters', filterId);
  await deleteDoc(filterRef);
}

/**
 * Load all filters (public + user's private filters)
 */
export async function loadFilters(userId: string): Promise<SavedFilter[]> {
  const filters: SavedFilter[] = [];

  // Get public filters
  const publicQuery = query(
    collection(db, 'saved_filters'),
    where('isPublic', '==', true),
    orderBy('name')
  );
  const publicSnapshot = await getDocs(publicQuery);
  publicSnapshot.forEach(doc => {
    const data = doc.data();
    filters.push({
      id: doc.id,
      name: data.name,
      isPublic: data.isPublic,
      conditions: data.conditions || [],
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      count: data.count,
    });
  });

  // Get user's private filters
  const privateQuery = query(
    collection(db, 'saved_filters'),
    where('isPublic', '==', false),
    where('createdBy', '==', userId),
    orderBy('name')
  );
  const privateSnapshot = await getDocs(privateQuery);
  privateSnapshot.forEach(doc => {
    const data = doc.data();
    filters.push({
      id: doc.id,
      name: data.name,
      isPublic: data.isPublic,
      conditions: data.conditions || [],
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      count: data.count,
    });
  });

  return filters;
}

/**
 * Get a single filter by ID
 */
export async function getFilter(filterId: string): Promise<SavedFilter | null> {
  const filterRef = doc(db, 'saved_filters', filterId);
  const filterSnap = await getDocs(query(collection(db, 'saved_filters'), where('__name__', '==', filterId)));
  
  if (filterSnap.empty) return null;
  
  const data = filterSnap.docs[0].data();
  return {
    id: filterSnap.docs[0].id,
    name: data.name,
    isPublic: data.isPublic,
    conditions: data.conditions || [],
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    count: data.count,
  };
}
