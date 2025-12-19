"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Phone, ExternalLink, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Store {
  id: string;
  name: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
  copper_company_id?: number;
  lat?: number;
  lng?: number;
  distance?: number;
}

interface StoreLocatorMapProps {
  apiKey: string;
  stores: Store[];
  mapId?: string;
}

export default function StoreLocatorMap({ apiKey, stores, mapId = '2a46db8ff41f5390438260c9' }: StoreLocatorMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStores, setFilteredStores] = useState<Store[]>(stores);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Google Maps script
  useEffect(() => {
    if ((window as any).google) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [apiKey]);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    const google = (window as any).google;
    
    // Force dark mode by setting color scheme
    const newMap = new google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 }, // Center of USA
      zoom: 4,
      mapId: mapId, // Kanva branded map style
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      colorScheme: 'DARK', // Force dark mode
    });

    setMap(newMap);
  }, [isLoaded, map]);

  // Update filtered stores when stores prop changes
  useEffect(() => {
    setFilteredStores(stores);
  }, [stores]);

  // Geocode stores and add markers
  useEffect(() => {
    if (!map || !isLoaded || stores.length === 0) return;

    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    const newMarkers: any[] = [];
    const bounds = new google.maps.LatLngBounds();

    console.log('🗺️ Adding markers for stores:', stores.length);

    stores.forEach((store) => {
      const address = `${store.address_line_1}, ${store.city}, ${store.state} ${store.postal_code}`;
      
      geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const position = results[0].geometry.location;
          
          // Create custom Kanva green marker
          const marker = new google.maps.Marker({
            position,
            map,
            title: store.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#97D500',
              fillOpacity: 1,
              strokeColor: '#17281A',
              strokeWeight: 2,
            },
          });

          marker.addListener('click', () => {
            setSelectedStore(store);
            map.panTo(position);
            map.setZoom(14);
          });

          newMarkers.push(marker);
          bounds.extend(position);

          // Store lat/lng for distance calculation
          store.lat = position.lat();
          store.lng = position.lng();
        }
      });
    });

    setMarkers(newMarkers);
    
    // Fit map to show all markers
    setTimeout(() => {
      if (newMarkers.length > 0) {
        map.fitBounds(bounds);
      }
    }, 1000);

    return () => {
      newMarkers.forEach(marker => marker.setMap(null));
    };
  }, [map, stores, isLoaded]);

  // Handle search
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || !map || !isLoaded) return;

    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery }, (results: any, status: any) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        setUserLocation({ lat: location.lat(), lng: location.lng() });
        map.setCenter(location);
        map.setZoom(10);

        // Calculate distances and sort stores
        const storesWithDistance = stores.map(store => {
          if (store.lat && store.lng) {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
              location,
              new google.maps.LatLng(store.lat, store.lng)
            );
            return { ...store, distance: distance * 0.000621371 }; // Convert meters to miles
          }
          return store;
        }).sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

        setFilteredStores(storesWithDistance);
      } else {
        toast.error('Location not found. Please try a different search.');
      }
    });
  }, [searchQuery, map, stores, isLoaded]);

  // Generate embed code
  const generateEmbedCode = () => {
    const embedUrl = `${window.location.origin}/store-locator-embed`;
    return `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
  };

  const copyEmbedCode = () => {
    const code = generateEmbedCode();
    navigator.clipboard.writeText(code);
    setEmbedCopied(true);
    toast.success('Embed code copied to clipboard!');
    setTimeout(() => setEmbedCopied(false), 3000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
      {/* Sidebar */}
      <div className="lg:w-1/3 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Search Box */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Type a postcode or address..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-kanva-green focus:border-transparent"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
          <button
            onClick={handleSearch}
            className="w-full mt-3 bg-[#97D500] hover:bg-[#85BD00] text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <Search className="h-5 w-5" />
            Search
          </button>
        </div>

        {/* Store List */}
        <div className="flex-1 overflow-y-auto">
          {stores.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No stores on locator. Toggle stores ON in the Stores tab.</p>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No stores found. Try searching for a different location.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredStores.map((store, index) => (
                <div
                  key={store.id}
                  onClick={() => {
                    setSelectedStore(store);
                    if (store.lat && store.lng && map) {
                      map.panTo({ lat: store.lat, lng: store.lng });
                      map.setZoom(14);
                    }
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedStore?.id === store.id ? 'bg-green-50 border-l-4 border-kanva-green' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-kanva-green rounded-full flex items-center justify-center text-white font-bold text-sm">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{store.name}</h3>
                        {store.distance && (
                          <span className="flex-shrink-0 text-xs font-medium text-kanva-green bg-green-50 px-2 py-1 rounded">
                            {store.distance.toFixed(1)} mi
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {store.address_line_1}
                      </p>
                      <p className="text-sm text-gray-600">
                        {store.city}, {store.state} {store.postal_code}
                      </p>
                      {store.phone && (
                        <a
                          href={`tel:${store.phone}`}
                          className="inline-flex items-center gap-1 text-sm text-kanva-green hover:text-[#85BD00] mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3" />
                          {store.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Embed Code Button */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={copyEmbedCode}
            className="w-full bg-[#17281A] hover:bg-[#2a3d2e] text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {embedCopied ? (
              <>
                <Check className="h-5 w-5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                Copy Embed Code for Shopify
              </>
            )}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="lg:w-2/3 rounded-lg overflow-hidden shadow-lg">
        <div ref={mapRef} className="w-full h-full min-h-[400px]" />
      </div>
    </div>
  );
}
