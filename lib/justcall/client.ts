/**
 * JustCall API Client
 * Documentation: https://developer.justcall.io/
 */

export interface JustCallConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

export interface JustCallUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  status?: string;
  active?: boolean;
}

export interface JustCallCallRecord {
  id: number;
  call_sid?: string;
  contact_number: string;
  contact_name?: string;
  contact_email?: string;
  justcall_number: string;
  justcall_line_name?: string;
  agent_id?: number;
  agent_name?: string;
  agent_email?: string;
  agent_active?: string;
  call_date: string;
  call_time: string;
  call_user_date?: string;
  call_user_time?: string;
  cost_incurred?: number;
  call_info: {
    direction: 'Incoming' | 'Outgoing';
    type: string;
    missed_call_reason?: string;
    status?: string;
    disposition?: string;
    notes?: string;
    rating?: string;
    recording?: string;
    recording_child?: string;
    voicemail_transcription?: string;
    call_traits?: string[];
  };
  call_duration: {
    friendly_duration: string;
    queue_wait_time?: number;
    ring_time?: number;
    hold_time?: number;
    wrap_up_time?: number;
    total_duration: number;
    conversation_time: number;
    handle_time?: number;
  };
  queue_callback?: any;
  ivr_info?: any;
  justcall_ai?: any;
  tags?: string[];
  manual_call_score?: number;
  call_summary?: string;
}

export interface JustCallMetrics {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  completedCalls: number;
  missedCalls: number;
  totalDuration: number; // in seconds
  averageDuration: number; // in seconds
  callsByDay: Record<string, number>;
  callsByStatus: Record<string, number>;
}

export interface JustCallCallsParams {
  agent_id?: number;
  agent_email?: string;
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
  direction?: 'Incoming' | 'Outgoing';
  type?: string; // Call type filter
  limit?: number;
  offset?: number;
  page?: number;
}

export interface JustCallSMSRecord {
  id: number;
  contact_number: string;
  contact_name?: string;
  agent_id?: number;
  agent_name?: string;
  agent_email?: string;
  message: string;
  direction: 'Incoming' | 'Outgoing';
  sent_at: string; // ISO timestamp
  delivered_at?: string;
  status: string; // "sent", "delivered", "failed", etc.
  justcall_number: string;
  created_at: string;
}

export interface JustCallSMSParams {
  agent_id?: number;
  agent_email?: string;
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
  direction?: 'Incoming' | 'Outgoing';
  limit?: number;
  page?: number;
}

export class JustCallClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(config: JustCallConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl || 'https://api.justcall.io/v2.1';
  }

  /**
   * Make authenticated request to JustCall API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // JustCall uses Basic Auth with API Key and Secret
    const authString = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `JustCall API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[JustCall] API request failed:', error);
      throw error;
    }
  }

  /**
   * Get all users/agents from JustCall
   * This fetches from multiple endpoints to get complete team data
   */
  async getUsers(): Promise<JustCallUser[]> {
    try {
      // Fetch from users endpoint first
      const queryParams = new URLSearchParams({
        available: 'false',
        page: '0',
        per_page: '100',
        order: 'desc'
      });
      
      const response = await this.request<{ data: JustCallUser[] }>(`/users?${queryParams.toString()}`);
      const users = response.data || [];
      
      // Also fetch phone numbers to get all team members
      // Phone numbers have number_owner field with user details
      try {
        const phoneResponse = await this.request<{ data: any[] }>(`/phone-numbers?page=0&per_page=100`);
        const phoneNumbers = phoneResponse.data || [];
        
        // Track emails we've already added
        const userEmails = new Set(users.map(u => u.email?.toLowerCase()));
        
        // Extract unique users from phone number owners
        for (const phone of phoneNumbers) {
          const owner = phone.number_owner;
          if (owner && owner.email && !userEmails.has(owner.email.toLowerCase())) {
            users.push({
              id: owner.id,
              email: owner.email,
              name: owner.name || 'Unknown',
              phone: phone.friendly_number || phone.justcall_number,
              status: 'active',
              active: true,
            });
            userEmails.add(owner.email.toLowerCase());
          }
        }
      } catch (phoneError) {
        console.warn('[JustCall] Could not fetch phone numbers:', phoneError);
      }
      
      return users;
    } catch (error) {
      console.error('[JustCall] Failed to fetch users:', error);
      return [];
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<JustCallUser | null> {
    const users = await this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Get call records with filters
   */
  async getCalls(params: JustCallCallsParams = {}): Promise<JustCallCallRecord[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.agent_id) queryParams.append('agent_id', params.agent_id.toString());
      if (params.agent_email) queryParams.append('agent_email', params.agent_email);
      if (params.start_date) queryParams.append('start_date', params.start_date);
      if (params.end_date) queryParams.append('end_date', params.end_date);
      if (params.direction) queryParams.append('direction', params.direction);
      if (params.type) queryParams.append('type', params.type);
      if (params.limit) queryParams.append('per_page', params.limit.toString()); // JustCall uses per_page, not limit
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.page) queryParams.append('page', params.page.toString());

      const endpoint = `/calls${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await this.request<{ data: JustCallCallRecord[]; total?: number; page?: number; per_page?: number }>(endpoint);
      
      console.log(`[JustCall API] Response for page ${params.page || 0}: ${response.data?.length || 0} calls, total: ${response.total || 'unknown'}`);
      
      return response.data || [];
    } catch (error) {
      console.error('[JustCall] Failed to fetch calls:', error);
      return [];
    }
  }

  /**
   * Get calls for a specific user by email with pagination
   */
  async getCallsByUserEmail(
    email: string,
    startDate?: string,
    endDate?: string
  ): Promise<JustCallCallRecord[]> {
    // First get the user to find their agent_id
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      console.log(`[JustCall] User not found: ${email}`);
      return [];
    }

    return this.getCalls({
      agent_id: user.id,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /**
   * Get calls for a specific user by agent_id (avoids extra API call)
   */
  async getCallsByAgentId(
    agentId: number,
    startDate?: string,
    endDate?: string
  ): Promise<JustCallCallRecord[]> {
    return this.getCalls({
      agent_id: agentId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /**
   * Get calls for a specific user by email with pagination
   */
  async getCallsByUserEmailWithPagination(
    email: string,
    startDate?: string,
    endDate?: string
  ): Promise<JustCallCallRecord[]> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      console.warn(`[JustCall] User not found: ${email}`);
      return [];
    }

    // JustCall API uses pagination - fetch all pages
    const allCalls: JustCallCallRecord[] = [];
    let page = 0;
    const perPage = 100; // Max per page
    let hasMore = true;

    while (hasMore) {
      const calls = await this.getCalls({
        agent_id: user.id,
        start_date: startDate,
        end_date: endDate,
        page: page,
        limit: perPage,
      });

      if (calls.length === 0) {
        hasMore = false;
      } else {
        allCalls.push(...calls);
        
        // If we got less than perPage, we've reached the end
        if (calls.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // Safety check to prevent infinite loops
      if (page > 100) {
        console.warn(`[JustCall] Stopping pagination at page ${page} for ${email}`);
        hasMore = false;
      }
    }

    console.log(`[JustCall] Fetched ${allCalls.length} calls for ${email} across ${page + 1} pages`);
    return allCalls;
  }

  /**
   * Calculate metrics from call records
   */
  calculateMetrics(calls: JustCallCallRecord[]): JustCallMetrics {
    const metrics: JustCallMetrics = {
      totalCalls: calls.length,
      inboundCalls: 0,
      outboundCalls: 0,
      completedCalls: 0,
      missedCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      callsByDay: {},
      callsByStatus: {},
    };

    calls.forEach(call => {
      // Direction
      if (call.call_info.direction === 'Incoming') metrics.inboundCalls++;
      if (call.call_info.direction === 'Outgoing') metrics.outboundCalls++;

      // Status/Type
      const callType = call.call_info.type || 'Unknown';
      if (callType.toLowerCase().includes('answered')) metrics.completedCalls++;
      if (callType.toLowerCase().includes('missed') || callType.toLowerCase().includes('unanswered')) {
        metrics.missedCalls++;
      }
      
      metrics.callsByStatus[callType] = (metrics.callsByStatus[callType] || 0) + 1;

      // Duration (use total_duration from call_duration object)
      metrics.totalDuration += call.call_duration?.total_duration || 0;

      // Calls by day (use call_date which is already in YYYY-MM-DD format)
      const date = call.call_date;
      metrics.callsByDay[date] = (metrics.callsByDay[date] || 0) + 1;
    });

    // Calculate average duration
    if (metrics.totalCalls > 0) {
      metrics.averageDuration = Math.round(metrics.totalDuration / metrics.totalCalls);
    }

    return metrics;
  }

  /**
   * Get metrics for a specific user
   */
  async getUserMetrics(
    email: string,
    startDate?: string,
    endDate?: string
  ): Promise<JustCallMetrics> {
    const calls = await this.getCallsByUserEmail(email, startDate, endDate);
    return this.calculateMetrics(calls);
  }

  /**
   * Get SMS records with filters
   */
  async getSMS(params: JustCallSMSParams = {}): Promise<JustCallSMSRecord[]> {
    try {
      const queryParams = new URLSearchParams();
      
      // Ensure agent_id is a valid number
      if (params.agent_id) {
        const agentId = Number(params.agent_id);
        if (!isNaN(agentId) && agentId > 0) {
          queryParams.append('agent_id', agentId.toString());
        }
      }
      
      if (params.agent_email) queryParams.append('agent_email', params.agent_email);
      if (params.start_date) queryParams.append('start_date', params.start_date);
      if (params.end_date) queryParams.append('end_date', params.end_date);
      if (params.direction) queryParams.append('direction', params.direction);
      if (params.limit) queryParams.append('per_page', params.limit.toString());
      if (params.page) queryParams.append('page', params.page.toString());

      const endpoint = `/texts/get${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await this.request<{ data: JustCallSMSRecord[]; total?: number }>(endpoint);
      
      console.log(`[JustCall SMS API] Response for page ${params.page || 0}: ${response.data?.length || 0} messages`);
      
      return response.data || [];
    } catch (error) {
      console.error('[JustCall] Failed to fetch SMS:', error);
      return [];
    }
  }

  /**
   * Get SMS for a specific user by email with pagination
   */
  async getSMSByUserEmail(
    email: string,
    startDate?: string,
    endDate?: string
  ): Promise<JustCallSMSRecord[]> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      console.warn(`[JustCall] User not found for SMS: ${email}`);
      return [];
    }

    console.log(`[JustCall SMS] Found user: ${user.name} (ID: ${user.id}, Email: ${user.email})`);

    // Try using agent_email instead of agent_id for SMS API
    // SMS API might not support agent_id filtering
    const allSMS: JustCallSMSRecord[] = [];
    let page = 0;
    const perPage = 100; // Max per page
    let hasMore = true;

    while (hasMore) {
      const messages = await this.getSMS({
        agent_email: user.email,
        start_date: startDate,
        end_date: endDate,
        page: page,
        limit: perPage,
      });

      if (messages.length === 0) {
        hasMore = false;
      } else {
        allSMS.push(...messages);
        
        // If we got less than perPage, we've reached the end
        if (messages.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // Safety check to prevent infinite loops
      if (page > 100) {
        console.warn(`[JustCall] Stopping SMS pagination at page ${page} for ${email}`);
        hasMore = false;
      }
    }

    console.log(`[JustCall] Fetched ${allSMS.length} SMS for ${email} across ${page + 1} pages`);
    return allSMS;
  }

  /**
   * Calculate SMS metrics from SMS records
   */
  calculateSMSMetrics(messages: JustCallSMSRecord[]): {
    totalSMS: number;
    inboundSMS: number;
    outboundSMS: number;
    smsByDay: Record<string, number>;
    smsByStatus: Record<string, number>;
  } {
    const metrics = {
      totalSMS: messages.length,
      inboundSMS: 0,
      outboundSMS: 0,
      smsByDay: {} as Record<string, number>,
      smsByStatus: {} as Record<string, number>,
    };

    messages.forEach(sms => {
      // Direction
      if (sms.direction === 'Incoming') metrics.inboundSMS++;
      if (sms.direction === 'Outgoing') metrics.outboundSMS++;

      // Status
      const status = sms.status || 'Unknown';
      metrics.smsByStatus[status] = (metrics.smsByStatus[status] || 0) + 1;

      // SMS by day (extract date from sent_at timestamp)
      const date = sms.sent_at.split('T')[0]; // Get YYYY-MM-DD
      metrics.smsByDay[date] = (metrics.smsByDay[date] || 0) + 1;
    });

    return metrics;
  }
}

/**
 * Create JustCall client instance from environment variables
 */
export function createJustCallClient(): JustCallClient | null {
  const apiKey = process.env.JUSTCALL_API_KEY;
  const apiSecret = process.env.JUSTCALL_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.warn('[JustCall] API credentials not configured');
    return null;
  }

  return new JustCallClient({
    apiKey,
    apiSecret,
  });
}
