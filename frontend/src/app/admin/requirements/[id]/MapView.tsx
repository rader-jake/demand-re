'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  lead: any;
  matches: any[];
  onEditMatch: (match: any) => void;
}

const NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  'battery park city': [40.7121, -74.0176],
  'chelsea': [40.7465, -74.0014],
  'chinatown': [40.7158, -73.9970],
  'east harlem': [40.7957, -73.9389],
  'east village': [40.7265, -73.9815],
  'financial district': [40.7075, -74.0113],
  'flatiron': [40.7411, -73.9897],
  'gramercy': [40.7369, -73.9845],
  'greenwich village': [40.7336, -74.0027],
  'harlem': [40.8116, -73.9465],
  'hell\'s kitchen': [40.7638, -73.9918],
  'hudson yards': [40.7539, -74.0010],
  'kips bay': [40.7423, -73.9801],
  'little italy': [40.7191, -73.9973],
  'lower east side': [40.7150, -73.9843],
  'midtown': [40.7549, -73.9840],
  'midtown east': [40.7540, -73.9688],
  'midtown south': [40.7484, -73.9857],
  'murray hill': [40.7489, -73.9752],
  'nolita': [40.7230, -73.9950],
  'nomad': [40.7447, -73.9874],
  'soho': [40.7233, -74.0030],
  'tribeca': [40.7163, -74.0086],
  'upper east side': [40.7736, -73.9566],
  'upper west side': [40.7870, -73.9754],
  'washington heights': [40.8417, -73.9394],
  'west village': [40.7358, -74.0061],
  'williamsburg': [40.7081, -73.9571],
  'dumbo': [40.7033, -73.9884],
  'park slope': [40.6710, -73.9763],
  'brooklyn heights': [40.6960, -73.9933],
  'astoria': [40.7644, -73.9235],
  'long island city': [40.7447, -73.9485],
  'brooklyn': [40.6782, -73.9442],
  'manhattan': [40.7831, -73.9712],
  'queens': [40.7282, -73.7949],
  'bronx': [40.8448, -73.8648],
  'staten island': [40.5795, -74.1502],
};

export default function MapView({ lead, matches, onEditMatch }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [tenantCenter, setTenantCenter] = useState<[number, number] | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const tenantCircleRef = useRef<L.Circle | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Setup default icon fix
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);

  // Geocode tenant desired location
  useEffect(() => {
    if (!lead?.desired_location) {
      setTenantCenter([40.7128, -74.0060]); // NYC center fallback
      return;
    }
    const loc = lead.desired_location.toLowerCase().trim();
    if (NEIGHBORHOOD_COORDS[loc]) {
      setTenantCenter(NEIGHBORHOOD_COORDS[loc]);
      return;
    }

    setGeocoding(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(lead.desired_location + ', New York')}&limit=1`, {
      headers: { 'User-Agent': 'CRE-Marketplace-Admin' }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setTenantCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
          setTenantCenter([40.7128, -74.0060]);
        }
      })
      .catch(() => setTenantCenter([40.7128, -74.0060]))
      .finally(() => setGeocoding(false));
  }, [lead?.desired_location]);

  // Initialize/Update Map Viewport
  useEffect(() => {
    if (!mapRef.current || !tenantCenter) return;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(tenantCenter, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap.current);
    } else {
      leafletMap.current.setView(tenantCenter, 13);
    }
  }, [tenantCenter]);

  // Update Markers
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !tenantCenter) return;

    // Clear old markers/circle
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (tenantCircleRef.current) {
      tenantCircleRef.current.remove();
    }

    // Add Tenant Area marker (circle)
    if (lead?.desired_location) {
      tenantCircleRef.current = L.circle(tenantCenter, {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        radius: 1000 // ~1km radius
      }).addTo(map);
      
      const tenantMarker = L.marker(tenantCenter, {
        icon: L.divIcon({
          className: 'custom-tenant-marker',
          html: `<div style="background-color: #3b82f6; color: white; border: 2px solid white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" title="Tenant preferred: ${lead.desired_location}">T</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      }).addTo(map).bindPopup(`<b>Tenant Desired Location:</b><br/>${lead.desired_location}`);
      markersRef.current.push(tenantMarker);
    }

    // Add match pins
    const bounds = L.latLngBounds([tenantCenter]);
    let hasValidMatchCoords = false;

    matches.forEach(match => {
      const lat = parseFloat(match.latitude);
      const lng = parseFloat(match.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      hasValidMatchCoords = true;
      bounds.extend([lat, lng]);

      // Color code verification status
      const color = match.verification_status === 'verified' 
        ? '#10b981' 
        : match.verification_status === 'unavailable' 
          ? '#ef4444' 
          : '#f59e0b';
      
      const scoreHtml = match.match_score 
        ? `<div style="margin-top: 4px;"><span style="background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 9999px;">Match Score: ${match.match_score}/100</span></div>` 
        : '';

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-match-marker',
          html: `<div style="background-color: ${color}; color: white; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 12px;" title="${match.listing_title}">M</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(map);

      // Construct popup content element
      const container = document.createElement('div');
      container.style.width = '200px';
      container.className = 'text-neutral-800';
      container.innerHTML = `
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${match.listing_title || 'Commercial Match'}</div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${match.address || 'Address not listed'}</div>
        <div style="font-size: 11px; margin-bottom: 6px;">Size: <strong>${match.square_feet || 'N/A'} sq ft</strong> | Rent: <strong>${match.rent || 'N/A'}</strong></div>
        ${scoreHtml}
        <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        </div>
      `;

      const editBtn = document.createElement('button');
      editBtn.className = 'w-full text-center bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 font-semibold text-xs py-1 px-2.5 rounded-xl transition';
      editBtn.style.color = '#2563eb';
      editBtn.style.backgroundColor = '#eff6ff';
      editBtn.style.border = '1px solid #bfdbfe';
      editBtn.style.borderRadius = '8px';
      editBtn.style.padding = '4px 8px';
      editBtn.style.fontWeight = 'bold';
      editBtn.style.cursor = 'pointer';
      editBtn.style.fontSize = '11px';
      editBtn.innerText = '✏️ Edit Match Details';
      editBtn.onclick = () => {
        onEditMatch(match);
        marker.closePopup();
      };
      container.querySelector('div:last-child')?.appendChild(editBtn);

      marker.bindPopup(container);
      markersRef.current.push(marker);
    });

    if (hasValidMatchCoords) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [matches, tenantCenter, lead]);

  return (
    <div className="card bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-md relative">
      {geocoding && (
        <div className="absolute top-6 right-6 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-neutral-200 shadow-sm text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
          <svg className="animate-spin h-3.5 w-3.5 text-brand-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Geocoding target location...
        </div>
      )}
      <div ref={mapRef} style={{ height: '480px', width: '100%', borderRadius: '14px' }} className="z-10" />
    </div>
  );
}
