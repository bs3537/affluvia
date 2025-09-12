import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, X, Users, AlertCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";

interface EmailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tabName: string;
}

export function EmailDrawer({ isOpen, onClose, tabName }: EmailDrawerProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [characterCount, setCharacterCount] = useState(0);
  const maxCharacters = 6000; // Approximately 1000 words

  // Fetch user emails count
  const { data: userEmails, isLoading: isLoadingEmails } = useQuery({
    queryKey: ["/api/admin/user-emails"],
    enabled: isOpen,
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; tabName: string }) => {
      const response = await fetch("/api/admin/send-investment-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Sent Successfully",
        description: `Investment update sent to ${data.recipientCount} users`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    setCharacterCount(message.length);
  }, [message]);

  const handleClose = () => {
    setSubject("");
    setMessage("");
    setCharacterCount(0);
    onClose();
  };

  const handleSend = () => {
    if (!subject.trim()) {
      toast({
        title: "Subject Required",
        description: "Please enter a subject for your email",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message for your email",
        variant: "destructive",
      });
      return;
    }

    if (message.length > maxCharacters) {
      toast({
        title: "Message Too Long",
        description: `Message exceeds ${maxCharacters} characters (approximately 1000 words)`,
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({ subject, message, tabName });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] sm:h-[80vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-t-2 border-purple-600/50"
      >
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-600/30 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                <Mail className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <SheetTitle className="text-2xl text-white font-bold">Send Investment Update</SheetTitle>
                <SheetDescription className="mt-1 text-gray-400">
                  Send an email update about changes in the{" "}
                  <Badge 
                    variant="secondary" 
                    className="ml-1 bg-purple-900/50 text-purple-200 border border-purple-600/30"
                  >
                    {tabName}
                  </Badge>{" "}
                  portfolio
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full hover:bg-purple-900/30 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Recipients Section */}
          <div className="space-y-2">
            <Label htmlFor="recipients" className="flex items-center gap-2 text-purple-200">
              <Users className="h-4 w-4" />
              Recipients
            </Label>
            <div className="p-4 bg-gray-900 rounded-lg border border-purple-600/20 shadow-inner">
              {isLoadingEmails ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading recipients...
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">All registered users</span>
                  <Badge 
                    variant="outline" 
                    className="border-purple-600/50 text-purple-300 bg-purple-900/20"
                  >
                    {userEmails?.count || 0} users
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Subject Section */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-purple-200">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-gray-900 border-purple-600/30 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20"
            />
          </div>

          {/* Message Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message" className="text-purple-200">Message</Label>
              <div className="flex items-center gap-2">
                {characterCount > maxCharacters * 0.9 && (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className={`text-sm ${
                  characterCount > maxCharacters 
                    ? "text-red-400" 
                    : characterCount > maxCharacters * 0.9 
                    ? "text-yellow-400" 
                    : "text-gray-500"
                }`}>
                  {characterCount} / {maxCharacters} characters
                </span>
              </div>
            </div>
            <Textarea
              id="message"
              placeholder="Compose your investment update message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[300px] bg-gray-900 border-purple-600/30 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20 resize-none"
              maxLength={maxCharacters}
            />
            <p className="text-xs text-gray-500">
              Write about portfolio changes, new positions opened, positions closed, or any other relevant updates.
            </p>
          </div>
        </div>

        <SheetFooter className="mt-8 flex-col sm:flex-row gap-3 pt-6 border-t border-purple-600/20">
          <Button
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto border-purple-600/30 text-purple-800 dark:text-purple-800 hover:bg-purple-900/30 hover:text-white hover:border-purple-500 font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendEmailMutation.isPending || !subject || !message}
            className="w-full sm:w-auto bg-purple-800 hover:bg-purple-700 text-white border border-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] disabled:opacity-50 disabled:shadow-none"
          >
            {sendEmailMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Update
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}