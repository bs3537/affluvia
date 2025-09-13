import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Paperclip, 
  X, 
  FileText, 
  Image, 
  FileSpreadsheet, 
  File, 
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FileUploadChatProps {
  onFilesUploaded: (files: File[], message?: string) => Promise<void>;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number; // in MB
}

interface SelectedFile {
  file: File;
  id: string;
  preview?: string;
}

export function FileUploadChat({ 
  onFilesUploaded, 
  disabled = false, 
  maxFiles = 5, 
  maxFileSize = 25 
}: FileUploadChatProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
    if (type.includes('word') || type.includes('document')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} not supported`;
    }
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }
    return null;
  };

  const processFiles = useCallback((files: FileList) => {
    const newFiles: SelectedFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      if (selectedFiles.length + newFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      // Create preview for images
      let preview: string | undefined;
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      }

      newFiles.push({
        file,
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        preview
      });
    });

    if (errors.length > 0) {
      setUploadError(errors.join('; '));
      return;
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
    setUploadError(null);
  }, [selectedFiles, maxFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      await onFilesUploaded(selectedFiles.map(sf => sf.file), message);
      
      // Clear files and message on success
      selectedFiles.forEach(sf => {
        if (sf.preview) {
          URL.revokeObjectURL(sf.preview);
        }
      });
      setSelectedFiles([]);
      setMessage('');
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const hasFiles = selectedFiles.length > 0;

  return (
    <div className="space-y-3">
      {/* File Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-4 transition-all duration-200
          ${isDragging 
            ? 'border-purple-500 bg-purple-950/20' 
            : 'border-gray-600 hover:border-purple-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="text-center">
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-300">
            {isDragging 
              ? 'Drop files here...' 
              : 'Click to select files or drag & drop'
            }
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PDF, Images, Excel, CSV, Word • Max {maxFileSize}MB each • Up to {maxFiles} files
          </p>
        </div>
      </div>

      {/* Selected Files */}
      {hasFiles && (
        <Card className="p-3 bg-gray-800/30 border-gray-700">
          <div className="space-y-2">
            {selectedFiles.map((selectedFile) => (
              <div
                key={selectedFile.id}
                className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg border border-gray-600"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 text-gray-400">
                    {getFileIcon(selectedFile.file.type)}
                  </div>
                  
                  {selectedFile.preview ? (
                    <img
                      src={selectedFile.preview}
                      alt={selectedFile.file.name}
                      className="w-8 h-8 object-cover rounded border border-gray-500"
                    />
                  ) : null}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {selectedFile.file.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-gray-400">
                        {formatFileSize(selectedFile.file.size)}
                      </p>
                      <Badge variant="secondary" className="text-xs bg-gray-600 text-gray-200 border-gray-500">
                        {selectedFile.file.type.split('/')[0]}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(selectedFile.id)}
                  className="flex-shrink-0 h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                  disabled={isUploading}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Message Input */}
      {hasFiles && (
        <div className="space-y-2">
          <Input
            placeholder="Optional message about these documents..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={disabled || isUploading}
            className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500"
          />
        </div>
      )}

      {/* Error Display */}
      {uploadError && (
        <div className="flex items-center space-x-2 p-3 bg-red-950/20 border border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-200">{uploadError}</p>
        </div>
      )}

      {/* Upload Button */}
      {hasFiles && (
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </p>
          
          <Button
            onClick={handleUpload}
            disabled={disabled || isUploading || selectedFiles.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </>
            )}
          </Button>
        </div>
      )}

      {/* Attach Files Button for Mobile/Alternative */}
      {!hasFiles && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-purple-400 border-purple-600 hover:bg-purple-900/20 bg-gray-800/50"
          >
            <Paperclip className="w-4 h-4 mr-2" />
            Attach Files
          </Button>
        </div>
      )}
    </div>
  );
}