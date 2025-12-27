import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { FilterSidebar } from './components/FilterSidebar';
import { DocumentCatalog } from './components/DocumentCatalog';
import { DynamicFormWizard } from './components/DynamicFormWizard';
import { Document } from './data/documents';
import { fetchDocuments } from './api/mockApi';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Loader } from 'lucide-react';

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['available']);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);

  // Fetch documents from backend on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Search filter
      if (
        searchQuery &&
        !doc.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !doc.description.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Category filter
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.some((cat) => doc.category.includes(cat))
      ) {
        return false;
      }

      // Format filter
      if (
        selectedFormats.length > 0 &&
        !selectedFormats.some((format) => doc.format.includes(format))
      ) {
        return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(doc.status)) {
        return false;
      }

      // Favorites filter
      if (showFavoritesOnly && !doc.isFavorite) {
        return false;
      }

      return true;
    });
  }, [documents, searchQuery, selectedCategories, selectedFormats, selectedStatuses, showFavoritesOnly]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleFormatToggle = (format: string) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleFavoritesToggle = () => {
    setShowFavoritesOnly(!showFavoritesOnly);
  };

  const handleToggleFavorite = (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id ? { ...doc, isFavorite: !doc.isFavorite } : doc
      )
    );
    const doc = documents.find((d) => d.id === id);
    if (doc) {
      toast.success(
        doc.isFavorite
          ? `Removed "${doc.title}" from favorites`
          : `Added "${doc.title}" to favorites`
      );
    }
  };

  const handleFillOut = (id: string) => {
    setActiveFormId(id);
  };

  const handleCloseForm = () => {
    setActiveFormId(null);
  };

  const handleNewDocument = () => {
    toast.info('New Document feature coming soon!');
  };

  // If a form is active, show the dynamic form wizard
  if (activeFormId) {
    return <DynamicFormWizard documentId={activeFormId} onClose={handleCloseForm} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Toaster position="top-right" />
      
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewDocument={handleNewDocument}
      />

      {isLoadingDocuments ? (
        <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
          <div className="text-center">
            <Loader className="mx-auto h-12 w-12 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-600">Loading documents...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <FilterSidebar
            selectedCategories={selectedCategories}
            selectedFormats={selectedFormats}
            selectedStatuses={selectedStatuses}
            showFavoritesOnly={showFavoritesOnly}
            onCategoryToggle={handleCategoryToggle}
            onFormatToggle={handleFormatToggle}
            onStatusToggle={handleStatusToggle}
            onFavoritesToggle={handleFavoritesToggle}
          />

          <DocumentCatalog
            documents={filteredDocuments}
            onFillOut={handleFillOut}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      )}
    </div>
  );
}