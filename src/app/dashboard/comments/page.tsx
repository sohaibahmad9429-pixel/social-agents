'use client';

/**
 * Comments Dashboard Page
 * AI-powered comment management with direct reply/delete from UI
 */

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Bot,
  Send,
  Trash2,
  Instagram,
  Facebook,
  Youtube,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  BookOpen,
  Plus,
  Settings,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================================================
// Types
// ============================================================================

interface PendingComment {
  id: string;
  comment_id: string;
  post_id: string;
  platform: 'instagram' | 'facebook' | 'youtube';
  username: string;
  original_comment: string;
  summary: string;
  status: 'pending';
  created_at: string;
}

interface Stats {
  pending: number;
  total: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Platform Icon Component
// ============================================================================

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'instagram') {
    return <Instagram className="h-4 w-4 text-pink-500" />;
  }
  if (platform === 'youtube') {
    return <Youtube className="h-4 w-4 text-red-600" />;
  }
  return <Facebook className="h-4 w-4 text-blue-600" />;
}

// ============================================================================
// Platform URL Helper
// ============================================================================

function getPlatformUrl(platform: string, postId: string): string {
  if (platform === 'youtube') {
    return `https://www.youtube.com/watch?v=${postId}`;
  }
  if (platform === 'instagram') {
    return `https://www.instagram.com/p/${postId}`;
  }
  if (platform === 'facebook') {
    return `https://www.facebook.com/${postId}`;
  }
  return '#';
}

// ============================================================================
// Main Component
// ============================================================================

export default function CommentsPage() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  // No filter needed - only pending comments are stored
  const [stats, setStats] = useState<Stats>({ pending: 0, total: 0 });
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const statCards = [
    {
      id: 'pending',
      value: stats.pending,
      label: 'Need your reply',
      icon: Clock,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
      description: 'Comments requiring your attention',
    },
    {
      id: 'ai',
      value: 'AI',
      label: 'Handles the rest',
      icon: Bot,
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      borderColor: 'border-accent/20',
      description: 'Auto-replies when confident',
    },
  ] as const;

  const actionButtonBase =
    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-[0.98]';
  const replyButtonStyles = `${actionButtonBase} bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/40`;
  const deleteButtonStyles = `${actionButtonBase} bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40`;
  const neutralButtonStyles = `${actionButtonBase} border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-muted-foreground/30 shadow-none`;

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch('/api/comments/pending');
      const data = await res.json();
      if (data.success) {
        setComments(data.comments || []);
        setStats(data.stats || { pending: 0, total: 0 });
      }
    } catch (error) {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Run the AI agent manually
  const runAgent = async () => {
    setRunningAgent(true);
    try {
      const res = await fetch('/api/cron/process-comments', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `✅ Processed! ${data.totalAutoReplied || 0} auto-replied, ${data.totalEscalated || 0} need your attention`,
          { duration: 5000 }
        );
        fetchComments();
      } else {
        toast.error(data.error || 'Failed to process comments');
      }
    } catch (error) {
      toast.error('Failed to run comment agent');
    } finally {
      setRunningAgent(false);
    }
  };

  // Send reply to a comment
  const sendReply = async (comment: PendingComment) => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    setSendingReply(true);
    try {
      const res = await fetch('/api/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.comment_id,
          pendingId: comment.id,
          message: replyText.trim(),
          platform: comment.platform,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Reply sent successfully!');
        setReplyingTo(null);
        setReplyText('');
        fetchComments();
      } else {
        toast.error(data.error || 'Failed to send reply');
      }
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Delete a comment from the platform
  const deleteComment = async (comment: PendingComment) => {
    if (!confirm('Delete this comment from ' + comment.platform + '?')) return;

    try {
      const res = await fetch('/api/comments/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.comment_id,
          pendingId: comment.id,
          platform: comment.platform,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.hidden ? 'Comment hidden' : 'Comment deleted');
        fetchComments();
      } else {
        toast.error(data.error || 'Failed to delete comment');
      }
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  // Dismiss a comment (remove from list without action)
  const dismissComment = async (id: string) => {
    try {
      await fetch(`/api/comments/pending/${id}`, { method: 'DELETE' });
      toast.success('Comment dismissed');
      fetchComments();
    } catch (error) {
      toast.error('Failed to dismiss comment');
    }
  };

  // Delete all pending comments
  const deleteAllComments = async () => {
    if (!confirm('Clear all pending comments? This cannot be undone.')) return;

    setDeletingAll(true);
    try {
      const res = await fetch('/api/comments/pending/bulk-delete', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${data.deleted || 0} comments`);
        fetchComments();
      } else {
        toast.error(data.error || 'Failed to delete comments');
      }
    } catch (error) {
      toast.error('Failed to delete comments');
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              Comments
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Comments that need your expertise
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKnowledgeModal(true)}
              className="group flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              title="Manage Knowledge Base"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Knowledge</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {statCards.map((card) => (
            <div
              key={card.id}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{card.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl ${card.bgColor} ${card.borderColor} border flex items-center justify-center`}>
                  <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-xs mt-3 text-muted-foreground">
                {card.description}
              </p>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="text-sm font-medium text-foreground">
            {stats.pending} comment{stats.pending !== 1 ? 's' : ''} need{stats.pending === 1 ? 's' : ''} your reply
          </span>
          {comments.length > 0 && (
            <button
              onClick={deleteAllComments}
              disabled={deletingAll}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-all disabled:opacity-50 border border-transparent hover:border-destructive/20"
              title="Delete all pending comments"
            >
              {deletingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear All
            </button>
          )}
          <button
            onClick={() => fetchComments()}
            className={`${comments.length > 0 ? '' : 'ml-auto'} p-2.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20`}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Comments List */}
        <div className={comments.length === 0 ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-20 border border-border rounded-xl bg-card shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
                <CheckCircle className="h-8 w-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">All caught up!</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto text-sm">
                No comments need your attention. The AI is handling the rest automatically.
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border border-border rounded-xl overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md bg-card group"
              >
                {/* Comment Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-lg border border-border">
                      <PlatformIcon platform={comment.platform} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{comment.username.startsWith('@') ? comment.username : `@${comment.username}`}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(comment.created_at)}
                        </span>
                      </div>
                      {comment.post_id && (
                        <a
                          href={getPlatformUrl(comment.platform, comment.post_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:text-primary/80 hover:underline font-medium"
                        >
                          View {comment.platform === 'youtube' ? 'Video' : 'Post'}
                        </a>
                      )}
                    </div>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-primary/20 font-medium">
                    <Clock className="h-3 w-3" />
                    Needs Reply
                  </span>
                </div>

                {/* AI Summary - Why this needs attention */}
                {comment.summary && (
                  <div className="px-5 py-4 border-b border-border bg-secondary/5">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-secondary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wider">AI Analysis</p>
                        <p className="text-sm text-foreground mt-1 leading-relaxed">{comment.summary}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Original Comment */}
                <div className="px-5 py-4 bg-card">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Original Comment</p>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed text-[15px]">
                    {comment.original_comment}
                  </p>
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-border bg-muted/30">
                  {replyingTo === comment.id ? (
                    <div className="space-y-4">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full px-4 py-3 border border-border rounded-xl resize-none h-32 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-card shadow-sm text-foreground placeholder:text-muted-foreground"
                        autoFocus
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => sendReply(comment)}
                          disabled={!replyText.trim() || sendingReply}
                          className={`${replyButtonStyles} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {sendingReply ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Send Reply
                        </button>
                        <button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                          className={neutralButtonStyles}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setReplyingTo(comment.id)}
                        className={replyButtonStyles}
                      >
                        <Send className="h-4 w-4" />
                        Reply
                      </button>
                      <button
                        onClick={() => deleteComment(comment)}
                        className={deleteButtonStyles}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                      <button
                        onClick={() => dismissComment(comment.id)}
                        className={neutralButtonStyles}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Knowledge Base Modal */}
        {showKnowledgeModal && (
          <KnowledgeBaseModal onClose={() => setShowKnowledgeModal(false)} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Knowledge Base Modal Component
// ============================================================================

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  question: string | null;
  answer: string;
  is_active: boolean;
}

function KnowledgeBaseModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    category: 'faq',
    title: '',
    question: '',
    answer: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/comments/knowledge');
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async () => {
    if (!newEntry.title || !newEntry.answer) {
      toast.error('Title and answer are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/comments/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Knowledge added!');
        setNewEntry({ category: 'faq', title: '', question: '', answer: '' });
        setShowAddForm(false);
        fetchEntries();
      } else {
        toast.error(data.error || 'Failed to add knowledge');
      }
    } catch (error) {
      toast.error('Failed to add knowledge');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return;

    try {
      const res = await fetch(`/api/comments/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Deleted');
        fetchEntries();
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const categories = [
    { value: 'faq', label: 'FAQ' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'shipping', label: 'Shipping' },
    { value: 'returns', label: 'Returns' },
    { value: 'product', label: 'Product Info' },
    { value: 'policy', label: 'Policies' },
    { value: 'support', label: 'Support' },
    { value: 'hours', label: 'Business Hours' },
    { value: 'contact', label: 'Contact Info' },
    { value: 'general', label: 'General' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-3 text-foreground">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              Knowledge Base
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add info so the AI can answer common questions automatically
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all border border-transparent hover:border-border"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Add New Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full p-5 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Plus className="h-5 w-5" />
              Add Knowledge Entry
            </button>
          )}

          {/* Add Form */}
          {showAddForm && (
            <div className="border border-border rounded-xl p-5 space-y-4 bg-muted/20 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block text-foreground">Category</label>
                  <select
                    value={newEntry.category}
                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block text-foreground">Title *</label>
                  <input
                    type="text"
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    placeholder="e.g., Return Policy"
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground">Common Question</label>
                <input
                  type="text"
                  value={newEntry.question}
                  onChange={(e) => setNewEntry({ ...newEntry, question: e.target.value })}
                  placeholder="e.g., What is your return policy?"
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground">Answer *</label>
                <textarea
                  value={newEntry.answer}
                  onChange={(e) => setNewEntry({ ...newEntry, answer: e.target.value })}
                  placeholder="The answer the AI should give..."
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-card h-28 resize-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={addEntry}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 border border-border text-muted-foreground rounded-lg hover:bg-muted hover:text-foreground transition-all font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Entries List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-3 bg-primary/10 rounded-full mb-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Loading entries...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 border border-border rounded-xl bg-muted/20">
              <div className="w-14 h-14 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center border border-border">
                <BookOpen className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">No knowledge entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add FAQs, policies, and product info so the AI can answer automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border border-border rounded-xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow duration-200 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-md font-medium capitalize border border-primary/20">
                          {entry.category}
                        </span>
                        <span className="font-semibold text-foreground">{entry.title}</span>
                      </div>
                      {entry.question && (
                        <p className="text-sm text-muted-foreground mb-1.5">
                          <span className="font-medium">Q:</span> {entry.question}
                        </p>
                      )}
                      <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">{entry.answer}</p>
                    </div>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-destructive/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
