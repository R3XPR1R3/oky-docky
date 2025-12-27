import { FileText, File, Globe, Clock, Archive, Star } from 'lucide-react';
import { Badge } from './ui/badge';

interface FilterSidebarProps {
  selectedCategories: string[];
  selectedFormats: string[];
  selectedStatuses: string[];
  showFavoritesOnly: boolean;
  onCategoryToggle: (category: string) => void;
  onFormatToggle: (format: string) => void;
  onStatusToggle: (status: string) => void;
  onFavoritesToggle: () => void;
}

const categories = ['Tax', 'Immigration', 'Business', 'Legal', 'Notary'];
const formats = ['PDF', 'DOCX', 'Online'];
const statuses = [
  { value: 'available', label: 'Available', icon: FileText },
  { value: 'coming-soon', label: 'Coming Soon', icon: Clock },
  { value: 'archived', label: 'Archived', icon: Archive },
];

export function FilterSidebar({
  selectedCategories,
  selectedFormats,
  selectedStatuses,
  showFavoritesOnly,
  onCategoryToggle,
  onFormatToggle,
  onStatusToggle,
  onFavoritesToggle,
}: FilterSidebarProps) {
  return (
    <aside className="w-64 border-r bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="space-y-6">
        {/* Favorites */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Star className="h-4 w-4" />
            Quick Access
          </h3>
          <button
            onClick={onFavoritesToggle}
            className={`w-full rounded-lg border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
              showFavoritesOnly
                ? 'border-yellow-400 bg-yellow-50 text-yellow-800 shadow-inner'
                : 'border-gray-200 bg-white text-gray-600 shadow-sm hover:border-yellow-300 hover:bg-yellow-50/50'
            }`}
            style={{
              boxShadow: showFavoritesOnly
                ? 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                : '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div className="flex items-center gap-2">
              <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-yellow-500 text-yellow-500' : ''}`} />
              Favorites Only
            </div>
          </button>
        </div>

        {/* Categories */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Categories</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const isSelected = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  onClick={() => onCategoryToggle(category)}
                  className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/30'
                      : 'border-gray-300 bg-white text-gray-700 shadow-sm hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  style={{
                    boxShadow: isSelected
                      ? '0 4px 6px rgba(59, 130, 246, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Format Filters */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Format</h3>
          <div className="space-y-2">
            {formats.map((format) => {
              const isSelected = selectedFormats.includes(format);
              return (
                <button
                  key={format}
                  onClick={() => onFormatToggle(format)}
                  className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-900 shadow-inner'
                      : 'border-gray-200 bg-white text-gray-600 shadow-sm hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                  style={{
                    boxShadow: isSelected
                      ? 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {format === 'Online' ? (
                    <Globe className="h-4 w-4" />
                  ) : (
                    <File className="h-4 w-4" />
                  )}
                  {format}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Filters */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Status</h3>
          <div className="space-y-2">
            {statuses.map(({ value, label, icon: Icon }) => {
              const isSelected = selectedStatuses.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => onStatusToggle(value)}
                  className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-green-400 bg-green-50 text-green-900 shadow-inner'
                      : 'border-gray-200 bg-white text-gray-600 shadow-sm hover:border-green-300 hover:bg-green-50/50'
                  }`}
                  style={{
                    boxShadow: isSelected
                      ? 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
