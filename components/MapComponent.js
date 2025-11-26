import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1Ijoiam1jY3VsbG91Z2g0IiwiYSI6ImNtMGJvOXh3cDBjNncya3B4cDg0MXFuYnUifQ.uDJKnqE9WgkvGXYGLge-NQ';

export default function MapComponent({ devices, targets, gpsLocation }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapStyle, setMapStyle] = useState('dark-v11');
  const [followGPS, setFollowGPS] = useState(false);
  const markersRef = useRef({});
  const circlesRef = useRef({});
  const gpsMarkerRef = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: `mapbox://styles/mapbox/${mapStyle}`,
      center: [-122.4194, 37.7749],
      zoom: 13
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    // Add GPS marker
    const el = document.createElement('div');
    el.className = 'gps-marker';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#10b981';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.5)';

    gpsMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([-122.4194, 37.7749])
      .addTo(map.current);

  }, []);

  // Update map style
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(`mapbox://styles/mapbox/${mapStyle}`);
    }
  }, [mapStyle]);

  // Update GPS location
  useEffect(() => {
    if (gpsLocation && gpsMarkerRef.current) {
      const coords = [gpsLocation.lon, gpsLocation.lat];
      gpsMarkerRef.current.setLngLat(coords);

      if (followGPS && map.current) {
        map.current.easeTo({
          center: coords,
          duration: 500
        });
      }
    }
  }, [gpsLocation, followGPS]);

  // Update device markers
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers that are no longer in devices list
    Object.keys(markersRef.current).forEach(address => {
      if (!devices.find(d => d.address === address)) {
        markersRef.current[address].remove();
        delete markersRef.current[address];

        // Remove circle
        if (circlesRef.current[address]) {
          if (map.current.getLayer(`circle-${address}`)) {
            map.current.removeLayer(`circle-${address}`);
          }
          if (map.current.getSource(`circle-${address}`)) {
            map.current.removeSource(`circle-${address}`);
          }
          delete circlesRef.current[address];
        }
      }
    });

    // Add or update markers
    devices.forEach(device => {
      if (device.emitterLat && device.emitterLon) {
        const isTarget = targets.some(t => t.address.toLowerCase() === device.address.toLowerCase());
        const coords = [device.emitterLon, device.emitterLat];

        // Create or update CEP circle
        const circleId = `circle-${device.address}`;
        const accuracy = device.emitterAccuracy || 50;

        // Create circle for CEP
        const circle = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: coords
            }
          }]
        };

        if (map.current.getSource(circleId)) {
          map.current.getSource(circleId).setData(circle);
        } else {
          map.current.on('style.load', () => {
            if (!map.current.getSource(circleId)) {
              map.current.addSource(circleId, {
                type: 'geojson',
                data: circle
              });

              map.current.addLayer({
                id: circleId,
                type: 'circle',
                source: circleId,
                paint: {
                  'circle-radius': {
                    stops: [
                      [0, 0],
                      [20, metersToPixelsAtMaxZoom(accuracy, device.emitterLat)]
                    ],
                    base: 2
                  },
                  'circle-color': isTarget ? '#ef4444' : '#06b6d4',
                  'circle-opacity': 0.2,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': isTarget ? '#ef4444' : '#06b6d4',
                  'circle-stroke-opacity': 0.6
                }
              });
            }
          });
        }

        // Create or update marker
        if (markersRef.current[device.address]) {
          markersRef.current[device.address].setLngLat(coords);
        } else {
          const el = document.createElement('div');
          el.className = 'device-marker';
          el.style.width = '30px';
          el.style.height = '30px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = isTarget ? '#ef4444' : '#06b6d4';
          el.style.border = '3px solid white';
          el.style.cursor = 'pointer';
          el.style.boxShadow = isTarget
            ? '0 0 20px rgba(239, 68, 68, 0.8)'
            : '0 0 10px rgba(6, 182, 212, 0.5)';

          if (isTarget) {
            el.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
          }

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <div class="font-bold ${isTarget ? 'text-red-500' : 'text-cyan-400'}">${device.name || 'Unknown'}</div>
              <div class="text-sm text-gray-300">${device.address}</div>
              <div class="text-sm text-gray-400">RSSI: ${device.rssi} dBm</div>
              <div class="text-sm text-gray-400">Type: ${device.deviceType}</div>
              ${device.manufacturer ? `<div class="text-sm text-gray-400">${device.manufacturer}</div>` : ''}
              <div class="text-xs text-gray-500 mt-1">Accuracy: ±${Math.round(accuracy)}m</div>
            </div>
          `);

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map.current);

          markersRef.current[device.address] = marker;
        }
      }
    });
  }, [devices, targets]);

  const metersToPixelsAtMaxZoom = (meters, latitude) => {
    return meters / 0.075 / Math.cos(latitude * Math.PI / 180);
  };

  const cycleMapStyle = () => {
    const styles = ['dark-v11', 'streets-v12', 'satellite-streets-v12'];
    const currentIndex = styles.indexOf(mapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    setMapStyle(styles[nextIndex]);
  };

  const getStyleName = () => {
    const names = {
      'dark-v11': 'Dark',
      'streets-v12': 'Streets',
      'satellite-streets-v12': 'Satellite'
    };
    return names[mapStyle] || 'Dark';
  };

  return (
    <div className="relative h-full">
      <div ref={mapContainer} className="h-full" />

      {/* Map Controls */}
      <div className="absolute top-4 left-4 flex flex-col space-y-2">
        <button
          onClick={cycleMapStyle}
          className="px-4 py-2 bg-bluek9-dark/90 hover:bg-bluek9-dark text-white rounded-lg border border-bluek9-cyan/30 backdrop-blur-sm transition"
        >
          🗺 {getStyleName()}
        </button>

        <button
          onClick={() => setFollowGPS(!followGPS)}
          className={`px-4 py-2 rounded-lg border backdrop-blur-sm transition ${
            followGPS
              ? 'bg-green-600/90 hover:bg-green-600 border-green-400'
              : 'bg-bluek9-dark/90 hover:bg-bluek9-dark border-bluek9-cyan/30'
          } text-white`}
        >
          {followGPS ? '📍 Following GPS' : '📍 Follow GPS'}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-bluek9-dark/90 backdrop-blur-sm border border-bluek9-cyan/30 rounded-lg p-3 text-sm">
        <div className="font-semibold text-bluek9-cyan mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
            <span className="text-gray-300">Your Location</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white" />
            <span className="text-gray-300">Device</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white animate-pulse" />
            <span className="text-gray-300">Target</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-1 bg-cyan-500 opacity-40" />
            <span className="text-gray-300">CEP (50%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
