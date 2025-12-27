import { Search, Plus, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewDocument: () => void;
}

export function Header({ searchQuery, onSearchChange, onNewDocument }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-600/30">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-semibold tracking-tight text-gray-900">Oki-Doki</h1>
            <p className="text-xs text-gray-500">Smart Document Builder</p>
          </div>
        </div>

        {/* Logo Placeholder for Custom Logo */}
        <div className="ml-2 flex h-10 w-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
          <span className="text-xs text-gray-400">Your Logo</span>
        </div>

        {/* Search */}
        <div className="relative mx-auto w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search for documents..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-lg border-gray-200 bg-gray-50/50 pl-10 pr-4 shadow-inner transition-all focus:bg-white focus:shadow-md"
          />
        </div>

        {/* New Document Button */}
        <Button
          onClick={onNewDocument}
          className="h-10 gap-2 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 px-4 shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:shadow-blue-600/40"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Document</span>
        </Button>
      </div>
    </header>
  );
}
