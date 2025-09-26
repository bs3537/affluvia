import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle, Download, File, Loader2, Trash2, Upload, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SharedVaultFile {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string | null;
  uploaderName: string;
  createdAt: string | Date;
}

interface SharedVaultResponse {
  files: SharedVaultFile[];
}

const MAX_FILE_BYTES = parseInt(import.meta.env.VITE_SHARED_VAULT_MAX_FILE_BYTES || `${30 * 1024 * 1024}`, 10);

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || value % 1 === 0 ? 0 : 1)} ${units[i]}`;
}

export default function SharedVaultPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<SharedVaultResponse>({
    queryKey: ["shared-vault", "files"],
    queryFn: async () => {
      const res = await fetch("/api/shared-vault", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 400) {
          const body = await res.json();
          if (body?.error === 'select_client') {
            throw new Error('Please select a client before accessing the shared vault.');
          }
          if (body?.error === 'no_advisor_link') {
            throw new Error('No advisor is linked yet. Once an advisor connects, the shared vault will be available.');
          }
        }
        throw new Error('Failed to load shared vault files.');
      }
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const files = useMemo(() => data?.files ?? [], [data?.files]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      return await fetch('/api/shared-vault/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        if (res.status === 400) {
          const body = await res.json().catch(() => null);
          if (body?.error === 'no_advisor_link') {
            throw new Error('No advisor is linked yet. Vault uploads require an active advisor connection.');
          }
          throw new Error(body?.message || 'Upload failed.');
        }
        throw new Error('Upload failed.');
      }
      await queryClient.invalidateQueries({ queryKey: ["shared-vault", "files"] });
      toast({ title: 'File uploaded', description: 'The document is now available in the shared vault.' });
    },
  });

  useEffect(() => {
    if (!isUploading) {
      setUploadProgress(0);
    }
  }, [isUploading]);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filePendingDelete, setFilePendingDelete] = useState<SharedVaultFile | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await fetch(`/api/shared-vault/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Failed to delete file.');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shared-vault", "files"] });
      toast({ title: 'File deleted', description: 'The document has been removed from the shared vault.' });
    },
    onError: (err: any) => {
      const message = err?.message || 'Failed to delete file.';
      toast({ title: 'Deletion failed', description: message, variant: 'destructive' });
    },
    onSettled: () => {
      setDeletingId(null);
    }
  });

  const handleFileSelection = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: 'File too large', description: `Maximum allowed size is ${formatBytes(MAX_FILE_BYTES)}.`, variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      setIsUploading(true);
      setUploadProgress(10);
      const start = Date.now();
      const timer = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
      }, 500);

      try {
        await uploadMutation.mutateAsync(selectedFile);
      } finally {
        clearInterval(timer);
      }

      setUploadProgress(100);
      const end = Date.now();
      const elapsed = Math.ceil((end - start) / 1000);
      toast({
        title: 'Upload complete',
        description: `${selectedFile.name} uploaded in ${elapsed} second${elapsed === 1 ? '' : 's'}.`,
      });
      setSelectedFile(null);
    } catch (err: any) {
      const message = err?.message || 'Failed to upload file.';
      setError(message);
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteRequest = (file: SharedVaultFile) => {
    setFilePendingDelete(file);
  };

  const handleConfirmDelete = async () => {
    if (!filePendingDelete) return;
    const file = filePendingDelete;
    setDeletingId(file.id);
    try {
      await deleteMutation.mutateAsync(file.id);
    } catch (err: any) {
      const message = err?.message || 'Failed to delete file.';
      toast({ title: 'Deletion failed', description: message, variant: 'destructive' });
    } finally {
      setFilePendingDelete(null);
    }
  };

  const handleCancelDelete = () => {
    if (!deletingId) {
      setFilePendingDelete(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Vault</h1>
          <p className="text-sm text-gray-400 mt-1">
            Securely share documents between you and your advisor.
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card className="bg-gray-900/60 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Upload Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center bg-gray-900/40">
            <input
              id="shared-vault-file-input"
              type="file"
              className="hidden"
              onChange={(e) => handleFileSelection(e.target.files)}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.svg"
            />
            <label htmlFor="shared-vault-file-input" className="cursor-pointer inline-flex items-center gap-2 text-purple-300 hover:text-purple-200">
              <Upload className="h-5 w-5" />
              <span>Select a file to upload</span>
            </label>
            <p className="text-xs text-gray-500 mt-2">Maximum size: {formatBytes(MAX_FILE_BYTES)}. Supported formats: documents, spreadsheets, images.</p>
            {selectedFile && (
              <div className="mt-4 inline-flex items-center gap-3 bg-gray-800/70 px-4 py-2 rounded-full border border-gray-700">
                <File className="h-4 w-4 text-purple-300" />
                <span className="text-sm text-gray-200">{selectedFile.name}</span>
                <span className="text-xs text-gray-500">{formatBytes(selectedFile.size)}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button disabled={!selectedFile || isUploading} onClick={handleUpload}>
              Upload
            </Button>
            {selectedFile && !isUploading && (
              <p className="text-xs text-gray-500">Ready to upload "{selectedFile.name}"</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/60 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Vault Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full bg-gray-800/60" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-12">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-400">File Name</TableHead>
                    <TableHead className="text-gray-400">Uploaded By</TableHead>
                    <TableHead className="text-gray-400">Uploaded</TableHead>
                    <TableHead className="text-gray-400">Size</TableHead>
                    <TableHead className="text-gray-400 text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const createdAt = new Date(file.createdAt);
                    return (
                      <TableRow key={file.id} className="border-gray-800">
                        <TableCell className="text-gray-200">
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-purple-300" />
                            <span className="font-medium">{file.originalFilename}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-400">{file.uploaderName}</TableCell>
                        <TableCell className="text-sm text-gray-400">{formatDistanceToNow(createdAt, { addSuffix: true })}</TableCell>
                        <TableCell className="text-sm text-gray-400">{formatBytes(file.fileSize)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-purple-300 hover:text-purple-100"
                              asChild
                            >
                              <a href={`/api/shared-vault/${file.id}/download`}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:text-red-200"
                              disabled={deletingId === file.id}
                              onClick={() => handleDeleteRequest(file)}
                            >
                              {deletingId === file.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!filePendingDelete} onOpenChange={(open) => (!open ? handleCancelDelete() : undefined)}>
        <AlertDialogContent className="bg-gray-900 border border-gray-700 text-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete document?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently remove "{filePendingDelete?.originalFilename}" from the shared vault for you and your advisor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700" onClick={handleCancelDelete}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmDelete}
              disabled={!!deletingId}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
