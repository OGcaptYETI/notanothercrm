import { ApplicationStats } from '@/types';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  stats: ApplicationStats;
}

export default function TabNav({ activeTab, onTabChange, stats }: Props) {
  const tabs = [
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'approved', label: 'Approved', count: stats.approved },
    { id: 'denied', label: 'Denied', count: stats.denied },
    { id: 'all', label: 'All Applications', count: stats.total },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 min-w-[120px] whitespace-nowrap py-2.5 px-4 rounded-md font-medium text-sm transition-all
              ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <span>{tab.label}</span>
            <span className={`
              ml-2 py-0.5 px-2 rounded-full text-xs font-semibold
              ${
                activeTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-700'
              }
            `}>
              {tab.count}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
