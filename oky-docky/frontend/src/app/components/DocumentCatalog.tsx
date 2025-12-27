import { useState } from 'react';
import { Document } from '../data/documents';
import { DocumentCard } from './DocumentCard';
import { Star, Sparkles } from 'lucide-react';

interface DocumentCatalogProps {
  documents: Document[];
  onFillOut: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function DocumentCatalog({ documents, onFillOut, onToggleFavorite }: DocumentCatalogProps) {
  const favoriteDocuments = documents.filter((doc) => doc.isFavorite);
  const recentDocuments = documents.slice(0, 3); // Mock recent documents

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Favorites Section */}
        {favoriteDocuments.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md shadow-yellow-500/30">
                <Star className="h-4 w-4 fill-white text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">Your Favorites</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {favoriteDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onFillOut={onFillOut}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recently Used Section */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-md shadow-purple-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Recently Used</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recentDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onFillOut={onFillOut}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>

        {/* All Documents Section */}
        <section>
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">
              All Documents ({documents.length})
            </h2>
            <p className="text-sm text-gray-500">
              Browse and filter through our complete document catalog
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onFillOut={onFillOut}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>

        {documents.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white/50 p-12">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Star className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">No documents found</h3>
              <p className="text-sm text-gray-500">
                Try adjusting your filters or search query
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
