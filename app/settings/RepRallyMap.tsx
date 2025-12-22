'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, useLoadScript, InfoWindow } from '@react-google-maps/api';
import { Search, RefreshCw, MapPin, DollarSign, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface RepRallyCustomer {
  id: string;
  businessName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  totalRepRallyOrders: number;
  totalRepRallyRevenue: number;
  firstRepRallyOrder?: string;
  lastRepRallyOrder?: string;
  originalSalesRep?: string;
  lat?: number;
  lng?: number;
  isSwitcher?: boolean;
  matchedFbCustomer?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '550px',
};

const center = {
  lat: 39.8283,
  lng: -98.5795,
};

const GOOGLE_MAPS_LIBRARIES: ('marker')[] = ['marker'];

// Color gradient from red (low) to green (high)
function getRevenueColor(revenue: number, minRevenue: number, maxRevenue: number): string {
  if (maxRevenue === minRevenue) return '#22c55e'; // All same, use green
  
  const ratio = (revenue - minRevenue) / (maxRevenue - minRevenue);
  
  // Red (low) -> Yellow (mid) -> Green (high)
  if (ratio < 0.5) {
    // Red to Yellow
    const r = 239;
    const g = Math.round(68 + (ratio * 2) * (189 - 68));
    const b = 68;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Green
    const adjustedRatio = (ratio - 0.5) * 2;
    const r = Math.round(234 - adjustedRatio * (234 - 34));
    const g = Math.round(179 + adjustedRatio * (197 - 179));
    const b = Math.round(8 + adjustedRatio * (94 - 8));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export default function RepRallyMap() {
  const { isLoaded: mapsScriptLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    version: 'beta',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [customers, setCustomers] = useState<RepRallyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<RepRallyCustomer | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });
  const [mapsLoaded, setMapsLoaded] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSwitchersOnly, setShowSwitchersOnly] = useState(false);

  const stateNameToAbbr: { [key: string]: string } = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
    'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
    'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
    'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
    'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
  };

  const normalizeState = (state: string): string => {
    if (!state) return '';
    const normalized = state.trim().toUpperCase();
    if (normalized.length === 2) return normalized;
    return stateNameToAbbr[normalized] || normalized.slice(0, 2);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Try cached data first (fast)
      const response = await fetch('/api/cache/reprally-analytics?type=map');
      const result = await response.json();
      
      if (!response.ok || !result.cached) {
        // Fall back to old API if cache not built
        console.log('Cache not available, using fallback API...');
        const fallbackResponse = await fetch('/api/reprally/map-customers');
        const fallbackResult = await fallbackResponse.json();
        
        if (!fallbackResponse.ok || !fallbackResult.success) {
          throw new Error(fallbackResult.error || 'Failed to load customers');
        }
        setCustomers(fallbackResult.customers || []);
        console.log(`✅ Loaded ${fallbackResult.customers?.length || 0} RepRally customers (fallback)`);
        return;
      }

      // Transform cached data to match expected format
      const mappedCustomers = (result.customers || []).map((c: any) => ({
        id: c.customerId,
        businessName: c.businessName,
        billingAddress: c.billingAddress,
        billingCity: c.billingCity,
        billingState: c.billingState,
        billingZip: c.billingZip,
        totalRepRallyOrders: c.reprallyOrders || c.totalOrders,
        totalRepRallyRevenue: c.reprallyRevenue || c.totalRevenue,
        firstRepRallyOrder: c.firstOrderDate,
        lastRepRallyOrder: c.lastOrderDate,
        lat: c.lat,
        lng: c.lng,
        isSwitcher: c.isSwitcher
      }));
      
      setCustomers(mappedCustomers);
      const cacheAgeHours = result.cacheAgeMs ? Math.round(result.cacheAgeMs / 1000 / 60 / 60) : 0;
      console.log(`✅ Loaded ${mappedCustomers.length} RepRally customers from cache (${cacheAgeHours}h old)`);
    } catch (error: any) {
      console.error('Error loading RepRally customers:', error);
      toast.error(error.message || 'Failed to load RepRally customer data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const geocodeCustomers = async (customersToGeocode: RepRallyCustomer[]) => {
    const geocoder = new google.maps.Geocoder();
    const batchSize = 10;
    const delay = 200;
    let successCount = 0;

    const loadingToast = toast.loading(`Geocoding ${customersToGeocode.length} RepRally customers...`);

    try {
      for (let i = 0; i < customersToGeocode.length; i += batchSize) {
        const batch = customersToGeocode.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (customer) => {
            const stateAbbr = normalizeState(customer.billingState);
            const address = `${customer.billingAddress}, ${customer.billingCity}, ${stateAbbr} ${customer.billingZip}`;
            try {
              const result = await geocoder.geocode({ address });
              
              if (result.results[0]) {
                const location = result.results[0].geometry.location;
                customer.lat = location.lat();
                customer.lng = location.lng();

                // Save via API
                await fetch('/api/reprally/map-customers', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customerId: customer.id,
                    lat: customer.lat,
                    lng: customer.lng
                  })
                });
                successCount++;
              }
            } catch (error: any) {
              console.warn(`Geocoding failed for ${customer.businessName}:`, error.message);
            }
          })
        );

        const progress = i + batch.length;
        setGeocodingProgress({ current: progress, total: customersToGeocode.length });
        toast.loading(`Geocoding... ${progress}/${customersToGeocode.length}`, { id: loadingToast });
        
        if (i + batchSize < customersToGeocode.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      toast.success(`✅ Geocoded ${successCount} customers!`, { id: loadingToast, duration: 5000 });
      loadData();
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('❌ Geocoding failed', { id: loadingToast });
    } finally {
      setGeocodingProgress({ current: 0, total: 0 });
    }
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    setMapsLoaded(true);
  }, []);

  const onUnmount = useCallback(() => {
    markersRef.current.forEach(marker => marker.map = null);
    markersRef.current = [];
    setMap(null);
    setMapsLoaded(false);
  }, []);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = !searchQuery || 
        c.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.billingCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.billingState.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSwitcher = !showSwitchersOnly || c.isSwitcher;
      
      return matchesSearch && matchesSwitcher;
    });
  }, [customers, searchQuery, showSwitchersOnly]);

  // Customers with coordinates
  const geocodedCustomers = useMemo(() => {
    return filteredCustomers.filter(c => c.lat && c.lng);
  }, [filteredCustomers]);

  // Revenue range for color gradient
  const revenueRange = useMemo(() => {
    if (geocodedCustomers.length === 0) return { min: 0, max: 0 };
    const revenues = geocodedCustomers.map(c => c.totalRepRallyRevenue);
    return {
      min: Math.min(...revenues),
      max: Math.max(...revenues)
    };
  }, [geocodedCustomers]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredCustomers.length;
    const geocoded = geocodedCustomers.length;
    const totalRevenue = filteredCustomers.reduce((sum, c) => sum + c.totalRepRallyRevenue, 0);
    const switcherCount = filteredCustomers.filter(c => c.isSwitcher).length;
    return { total, geocoded, totalRevenue, switcherCount };
  }, [filteredCustomers, geocodedCustomers]);

  // Create markers when map and data are ready
  useEffect(() => {
    if (!mapsLoaded || !map) return;
    
    // Check if AdvancedMarkerElement is available
    if (!google.maps.marker?.AdvancedMarkerElement) {
      console.warn('AdvancedMarkerElement not available yet');
      return;
    }

    // Clear existing markers
    markersRef.current.forEach(marker => {
      try { marker.map = null; } catch (e) { /* ignore */ }
    });
    markersRef.current = [];

    geocodedCustomers.forEach(customer => {
      if (!customer.lat || !customer.lng) return;

      const color = getRevenueColor(customer.totalRepRallyRevenue, revenueRange.min, revenueRange.max);
      
      const pinContent = document.createElement('div');
      pinContent.innerHTML = `
        <div style="
          width: 12px;
          height: 12px;
          background-color: ${color};
          border: 2px solid ${customer.isSwitcher ? '#7c3aed' : '#ffffff'};
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        "></div>
      `;

      try {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: customer.lat, lng: customer.lng },
          content: pinContent,
          title: customer.businessName,
        });

        marker.addListener('click', () => {
          setSelectedCustomer(customer);
        });

        markersRef.current.push(marker);
      } catch (e) {
        console.warn('Failed to create marker for', customer.businessName, e);
      }
    });

    // Fit bounds if we have markers
    if (geocodedCustomers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      geocodedCustomers.forEach(c => {
        if (c.lat && c.lng) bounds.extend({ lat: c.lat, lng: c.lng });
      });
      map.fitBounds(bounds);
    }
  }, [mapsLoaded, map, geocodedCustomers, revenueRange]);

  const handleGeocodeMissing = () => {
    const missing = filteredCustomers.filter(c => !c.lat || !c.lng);
    if (missing.length === 0) {
      toast.success('All customers are already geocoded!');
      return;
    }
    geocodeCustomers(missing);
  };

  if (loadError) {
    return <div className="p-6 text-red-600">Error loading Google Maps</div>;
  }

  if (!mapsScriptLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <Image 
          src="/images/kanva_logo_rotate.gif" 
          alt="Loading..." 
          width={64}
          height={64}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
            <MapPin className="w-4 h-4" />
            RepRally Customers
          </div>
          <div className="text-2xl font-bold text-red-900">{stats.total}</div>
          <div className="text-xs text-gray-500">{stats.geocoded} mapped</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
            <DollarSign className="w-4 h-4" />
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-red-900">${stats.totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-600 text-sm font-medium">
            <TrendingDown className="w-4 h-4" />
            Switchers
          </div>
          <div className="text-2xl font-bold text-purple-900">{stats.switcherCount}</div>
          <div className="text-xs text-gray-500">Direct → RepRally</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-600">Revenue Scale</div>
          <div className="mt-2 h-4 rounded-full" style={{
            background: 'linear-gradient(to right, #ef4444, #eab308, #22c55e)'
          }}></div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>${revenueRange.min.toLocaleString()}</span>
            <span>${revenueRange.max.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showSwitchersOnly}
            onChange={(e) => setShowSwitchersOnly(e.target.checked)}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm text-gray-700">Switchers only</span>
        </label>

        <button
          onClick={handleGeocodeMissing}
          disabled={geocodingProgress.total > 0}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${geocodingProgress.total > 0 ? 'animate-spin' : ''}`} />
          {geocodingProgress.total > 0 
            ? `${geocodingProgress.current}/${geocodingProgress.total}`
            : 'Geocode Missing'}
        </button>

        <button onClick={loadData} className="btn btn-secondary">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-gray-200">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={4}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            mapId: 'reprally_map',
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          {selectedCustomer && selectedCustomer.lat && selectedCustomer.lng && (
            <InfoWindow
              position={{ lat: selectedCustomer.lat, lng: selectedCustomer.lng }}
              onCloseClick={() => setSelectedCustomer(null)}
            >
              <div className="p-2 max-w-xs">
                <h3 className="font-bold text-gray-900">{selectedCustomer.businessName}</h3>
                <p className="text-sm text-gray-600">
                  {selectedCustomer.billingCity}, {selectedCustomer.billingState}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Revenue:</span>
                    <span className="font-medium text-red-600">
                      ${selectedCustomer.totalRepRallyRevenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Orders:</span>
                    <span className="font-medium">{selectedCustomer.totalRepRallyOrders}</span>
                  </div>
                  {selectedCustomer.isSwitcher && (
                    <div className="mt-2 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      ⚠️ Switcher - was buying direct
                    </div>
                  )}
                  {selectedCustomer.matchedFbCustomer && (
                    <div className="text-xs text-gray-500 mt-1">
                      Matched: {selectedCustomer.matchedFbCustomer}
                    </div>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"></div>
          <span>Low Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-white shadow"></div>
          <span>Medium Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
          <span>High Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-purple-600 shadow"></div>
          <span>Switcher (purple border)</span>
        </div>
      </div>
    </div>
  );
}
