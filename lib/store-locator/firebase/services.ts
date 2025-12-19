"use client";

import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, serverTimestamp, Timestamp, addDoc, limit as firestoreLimit } from './db';

export interface RetailerApplication {
  id: string;
  businessName: string;
  dba?: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  address: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  businessType?: string;
  yearsInBusiness?: number;
  numberOfLocations?: number;
  squareFootage?: number;
  preferredProducts?: string[];
  estimatedMonthlyVolume?: string;
  storeHours?: string;
  locationDetails?: string;
  businessLicenseUrl?: string;
  storePhotoUrl?: string;
  resaleCertificateUrl?: string;
  storeLogoUrl?: string;
  status: 'pending' | 'approved' | 'denied' | 'more_info_needed';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
  denialReason?: string;
  copperContactId?: number;
  stockistLocationId?: string;
  latitude?: number;
  longitude?: number;
  submissionData?: any;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  photoUrl?: string;
  role: 'admin' | 'sales_manager' | 'sales_rep' | 'sales';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

class ApplicationService {
  private collectionName = 'retailer_applications';

  async getAll(filters?: { status?: string; limit?: number }) {
    try {
      const constraints = [];
      
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      constraints.push(orderBy('createdAt', 'desc'));
      
      if (filters?.limit) {
        constraints.push(firestoreLimit(filters.limit));
      }

      const q = query(collection(db, this.collectionName), ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as RetailerApplication[];
    } catch (error) {
      console.error('Error fetching applications:', error);
      throw error;
    }
  }

  async getById(id: string) {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Application not found');
      }
      
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as RetailerApplication;
    } catch (error) {
      console.error('Error fetching application:', error);
      throw error;
    }
  }

  async create(data: Partial<RetailerApplication>) {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<RetailerApplication>) {
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating application:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const [pending, approved, denied] = await Promise.all([
        this.getAll({ status: 'pending' }),
        this.getAll({ status: 'approved' }),
        this.getAll({ status: 'denied' }),
      ]);

      return {
        pending: pending.length,
        approved: approved.length,
        denied: denied.length,
        total: pending.length + approved.length + denied.length,
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }
}

class UserService {
  private collectionName = 'users';

  async getUser(uid: string) {
    try {
      const docRef = doc(db, this.collectionName, uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return docSnap.data() as User;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async updateUser(uid: string, data: Partial<User>) {
    try {
      const docRef = doc(db, this.collectionName, uid);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async isAdmin(uid: string): Promise<boolean> {
    const user = await this.getUser(uid);
    return user?.role === 'admin' || user?.role === 'sales_manager';
  }
}

class ApprovalLogService {
  private collectionName = 'approval_logs';

  async log(applicationId: string, action: string, performedBy: string, notes?: string) {
    try {
      await addDoc(collection(db, this.collectionName), {
        applicationId,
        action,
        performedBy,
        notes: notes || null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error logging approval action:', error);
    }
  }

  async getLogsForApplication(applicationId: string) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('applicationId', '==', applicationId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
  }
}

export const applicationService = new ApplicationService();
export const userService = new UserService();
export const approvalLogService = new ApprovalLogService();
