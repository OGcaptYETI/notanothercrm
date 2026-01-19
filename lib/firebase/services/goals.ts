import { db } from '@/lib/firebase/config';
import { 
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import { Goal, Metric, GoalPeriod, GoalType, User } from '@/types/goals';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';

// Helper to create Firestore converter
function createConverter<T>() {
  return {
    toFirestore: (data: T) => data,
    fromFirestore: (snap: any) => {
      const data = snap.data();
      // Convert Firestore Timestamps to Dates
      Object.keys(data).forEach(key => {
        if (data[key]?.toDate) {
          data[key] = data[key].toDate();
        }
      });
      return data as T;
    }
  };
}

// User Services
export const userService = {
  async getUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return null;
      
      const data = userDoc.data();
      return {
        id: userDoc.id,
        email: data.email || '',
        name: data.name || '',
        role: data.role || 'sales',
        title: data.title,
        copperId: data.copperId,
        photoUrl: data.photoUrl,
        passwordChanged: data.passwordChanged,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as User;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const q = query(collection(db, 'users'), orderBy('name'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Helper to convert Timestamp to Date
        const toDate = (val: any): Date => {
          if (!val) return new Date();
          if (val instanceof Date) return val;
          if (val.toDate && typeof val.toDate === 'function') return val.toDate();
          if (val.seconds) return new Date(val.seconds * 1000);
          return new Date();
        };
        
        return {
          id: doc.id,
          email: data.email || '',
          name: data.name || '',
          role: data.role || 'sales',
          title: data.title,
          copperId: data.copperId,
          photoUrl: data.photoUrl,
          passwordChanged: data.passwordChanged,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt)
        } as User;
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  subscribeToUser(userId: string, callback: (user: User | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'users', userId), (doc) => {
      if (!doc.exists()) {
        callback(null);
        return;
      }
      const data = doc.data();
      callback({
        id: doc.id,
        email: data.email || '',
        name: data.name || '',
        role: data.role || 'sales',
        title: data.title,
        copperId: data.copperId,
        photoUrl: data.photoUrl,
        passwordChanged: data.passwordChanged,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as User);
    });
  }
};

// Settings Services
export const settingsService = {
  async getSettings(userId: string): Promise<Record<string, any> | null> {
    try {
      const ref = doc(db, 'settings', userId);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return null;
    }
  },

  async updateSettings(userId: string, data: Record<string, any>): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', userId), {
        ...data,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  async getTeamGoals(): Promise<Record<string, any> | null> {
    try {
      const ref = doc(db, 'settings', 'team_goals');
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error fetching team goals:', error);
      return null;
    }
  },

  async updateTeamGoals(data: Record<string, any>): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', 'team_goals'), {
        ...data,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error updating team goals:', error);
      throw error;
    }
  },
};

// Goal Services
export const goalService = {
  async upsertGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const goalId = `${goal.userId}_${goal.type}_${goal.period}`;
      
      await setDoc(doc(db, 'goals', goalId), {
        ...goal,
        id: goalId,
        startDate: Timestamp.fromDate(goal.startDate),
        endDate: Timestamp.fromDate(goal.endDate),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
      
      return goalId;
    } catch (error) {
      console.error('Error upserting goal:', error);
      throw error;
    }
  },

  async getUserGoals(userId: string, period?: GoalPeriod): Promise<Goal[]> {
    try {
      let q = query(collection(db, 'goals'), where('userId', '==', userId));
      
      if (period) {
        q = query(q, where('period', '==', period));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type,
          period: data.period,
          target: data.target || 0,
          current: data.current || 0,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Goal;
      });
    } catch (error) {
      console.error('Error fetching goals:', error);
      return [];
    }
  },

  async getAllGoals(period?: GoalPeriod): Promise<Goal[]> {
    try {
      let q = query(collection(db, 'goals'), orderBy('userId'));
      
      if (period) {
        q = query(q, where('period', '==', period));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type,
          period: data.period,
          target: data.target || 0,
          current: data.current || 0,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Goal;
      });
    } catch (error) {
      console.error('Error fetching all goals:', error);
      return [];
    }
  },

  subscribeToGoals(userId: string, callback: (goals: Goal[]) => void): Unsubscribe {
    const q = query(collection(db, 'goals'), where('userId', '==', userId));
    
    return onSnapshot(q, (snapshot) => {
      const goals = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type,
          period: data.period,
          target: data.target || 0,
          current: data.current || 0,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Goal;
      });
      callback(goals);
    });
  }
};

// Metric Services
export const metricService = {
  async logMetric(metric: Omit<Metric, 'id' | 'createdAt'>): Promise<string> {
    try {
      const metricRef = doc(collection(db, 'metrics'));
      await setDoc(metricRef, {
        ...metric,
        id: metricRef.id,
        date: Timestamp.fromDate(metric.date),
        createdAt: serverTimestamp()
      });
      return metricRef.id;
    } catch (error) {
      console.error('Error logging metric:', error);
      throw error;
    }
  },

  async getMetrics(
    userId: string, 
    type: GoalType, 
    startDate: Date, 
    endDate: Date
  ): Promise<Metric[]> {
    try {
      const q = query(
        collection(db, 'metrics'),
        where('userId', '==', userId),
        where('type', '==', type),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type,
          value: data.value || 0,
          date: data.date?.toDate() || new Date(),
          source: data.source || 'manual',
          metadata: data.metadata,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Metric;
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return [];
    }
  },

  async getMetricsForPeriod(
    userId: string,
    type: GoalType,
    period: GoalPeriod
  ): Promise<Metric[]> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'daily':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'weekly':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarterly':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
    }

    return this.getMetrics(userId, type, startDate, endDate);
  },

  subscribeToMetrics(
    userId: string,
    callback: (metrics: Metric[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'metrics'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(100)
    );
    
    return onSnapshot(q, (snapshot) => {
      const metrics = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type,
          value: data.value || 0,
          date: data.date?.toDate() || new Date(),
          source: data.source || 'manual',
          metadata: data.metadata,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Metric;
      });
      callback(metrics);
    });
  },

  async getTeamMetrics(
    type: GoalType,
    period: GoalPeriod
  ): Promise<Map<string, number>> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'daily':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'weekly':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarterly':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
    }

    try {
      const q = query(
        collection(db, 'metrics'),
        where('type', '==', type),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
      
      const snapshot = await getDocs(q);
      const aggregated = new Map<string, number>();
      
      snapshot.docs.forEach(doc => {
        const metric = doc.data();
        const current = aggregated.get(metric.userId) || 0;
        aggregated.set(metric.userId, current + (metric.value || 0));
      });
      
      return aggregated;
    } catch (error) {
      console.error('Error fetching team metrics:', error);
      return new Map();
    }
  }
};
