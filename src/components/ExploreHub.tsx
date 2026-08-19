import React, { useState } from 'react';
import { MapPinIcon } from './icons';
import { LocationItem } from '../types';
import { SegmentedControl } from './SegmentedControl';
import { QiblaCompassView } from './QiblaCompassView';

interface ExploreHubProps {
  location: LocationItem;
}

type ExploreView = 'compass' | 'nearby';

export const ExploreHub: React.FC<ExploreHubProps> = ({ location }) => {
  const [view, setView] = useState<ExploreView>('compass');

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="sr-only">Keşfet</h1>

      <div className="w-full max-w-[var(--shell-w)] mx-auto px-4 pt-3">
        <SegmentedControl
          layoutId="explore-view-segment"
          value={view}
          onChange={(val) => setView(val as ExploreView)}
          options={[
            { value: 'compass', label: 'Pusula' },
            { value: 'nearby', label: 'Yakınımda' },
          ]}
        />
      </div>

      {view === 'compass' && (
        <div className="w-full max-w-[var(--shell-w)] mx-auto px-4 pt-4 pb-4">
          <QiblaCompassView location={location} active={view === 'compass'} />
        </div>
      )}

      {view === 'nearby' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 text-center">
          <MapPinIcon className="w-8 h-8 text-gold/40 mb-3" />
          <p className="text-sm font-semibold text-ink">Yakınımda</p>
          <p className="text-[11px] text-mist mt-1 max-w-[240px]">
            Yakındaki mekanlar yakında burada listelenecek.
          </p>
        </div>
      )}
    </div>
  );
};
