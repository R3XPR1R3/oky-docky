import { FileText, File, Globe, Star } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Document } from "../data/documents";

interface DocumentCardProps {
  document: Document;
  onFillOut: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function DocumentCard({
  document,
  onFillOut,
  onToggleFavorite,
}: DocumentCardProps) {
  const getBadgeColor = (badge?: string) => {
    switch (badge) {
      case "new":
        return "bg-green-500 text-white";
      case "updated":
        return "bg-blue-500 text-white";
      case "popular":
        return "bg-orange-500 text-white";
      default:
        return "";
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "Online":
        return <Globe className="h-3.5 w-3.5" />;
      case "PDF":
        return <FileText className="h-3.5 w-3.5" />;
      case "DOCX":
        return <File className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50/50 p-5 shadow-lg transition-all hover:border-blue-300 hover:shadow-xl"
      style={{
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.01) 2px,
            rgba(0, 0, 0, 0.01) 4px
          )
        `,
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      }}
    >
      {/* Favorite Star */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(document.id);
        }}
        className="absolute right-3 top-3 rounded-full p-1.5 transition-all hover:bg-yellow-100"
      >
        <Star
          className={`h-4 w-4 transition-all ${
            document.isFavorite
              ? "fill-yellow-500 text-yellow-500"
              : "text-gray-300 hover:text-yellow-400"
          }`}
        />
      </button>

      {/* Badge */}
      {document.badge && (
        <Badge
          className={`absolute left-3 top-3 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide shadow-md ${getBadgeColor(
            document.badge,
          )}`}
        >
          {document.badge}
        </Badge>
      )}

      {/* Content */}
      <div className="mt-6 flex flex-1 flex-col space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {document.title}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {document.description}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {/* Category Tags */}
          {document.category.map((cat) => (
            <Badge
              key={cat}
              variant="outline"
              className="rounded-full border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
            >
              {cat}
            </Badge>
          ))}

          {/* Format Tags */}
          {document.format.map((format) => (
            <Badge
              key={format}
              variant="outline"
              className="flex items-center gap-1 rounded-full border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700"
            >
              {getFormatIcon(format)}
              {format}
            </Badge>
          ))}
        </div>

        {/* Status Indicator */}
        {document.status === "coming-soon" && (
          <div className="flex items-center gap-2 text-xs text-orange-600">
            <span className="flex h-2 w-2 rounded-full bg-orange-400"></span>
            Coming Soon
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto pt-4">
          <Button
            onClick={() => onFillOut(document.id)}
            disabled={document.status === "coming-soon"}
            className={`w-full rounded-lg py-2.5 font-semibold shadow-md transition-all ${
              document.status === "coming-soon"
                ? "cursor-not-allowed bg-gray-300 text-gray-500"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40"
            }`}
            style={{
              boxShadow:
                document.status === "coming-soon"
                  ? "none"
                  : "0 4px 6px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            }}
          >
            {document.status === "coming-soon"
              ? "Coming Soon"
              : "Fill Out"}
          </Button>
        </div>
      </div>
    </div>
  );
}