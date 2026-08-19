import React, { useState } from 'react';
import { LocationItem } from '../types';
import { SegmentedControl } from './SegmentedControl';
import { QiblaCompassView } from './QiblaCompassView';
import { NearbyView } from './NearbyView';

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

      {view === 'nearby' && <NearbyView />}
    </div>
  );
};
