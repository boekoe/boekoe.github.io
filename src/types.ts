export type Profile = {
  id: string
  username: string
  fullName: string
  bio: string
  location: string
  avatarUrl: string
  coverUrl?: string
  verified?: boolean
  isAdmin?: boolean
  followers: number
  following: number
}

export type Comment = {
  id: string
  author: Profile
  body: string
  createdAt: string
  parentId?: string
  likes: number
  liked: boolean
  likedBy: string[]
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'fire'

export type PollOption = {
  id: string
  text: string
  votes: number
  voterIds: string[]
}

export type Poll = {
  question: string
  options: PollOption[]
  votedOptionId?: string
}

export type Post = {
  id: string
  author: Profile
  body: string
  imageUrl?: string
  imageUrls: string[]
  createdAt: string
  updatedAt?: string
  likes: number
  liked: boolean
  likedBy: string[]
  reaction?: ReactionType
  reactionCounts: Partial<Record<ReactionType, number>>
  reactionsByUser?: Partial<Record<string, ReactionType>>
  poll?: Poll
  revisions: PostRevision[]
  comments: Comment[]
  visibility: 'public' | 'private' | 'friends'
}

export type PostRevision = {
  id: string
  body: string
  createdAt: string
}

export type Notice = {
  id: string
  kind: 'like' | 'comment' | 'follow' | 'message' | 'system'
  postId?: string
  targetUrl?: string
  actor?: Profile
  text: string
  createdAt: string
  read: boolean
}

export type DirectMessage = {
  id: string
  senderId: string
  recipientId: string
  body: string
  createdAt: string
  read: boolean
  replyTo?: string
  attachmentPath?: string
  attachmentUrl?: string
  editedAt?: string
  deletedAt?: string
  reactions?: Record<string, MessageReaction>
  pending?: boolean
  failed?: boolean
}

export type MessageReaction = '👍' | '❤️' | '😂' | '😮' | '😢' | '🙏'

export type Report = {
  id: string
  reporter: string
  reporterEmail?: string
  reporterUsername?: string
  target?: string
  targetEmail?: string
  targetUsername?: string
  reason: string
  postId: string
  excerpt: string
  status: 'open' | 'reviewed' | 'removed'
  createdAt: string
}

export type AdminUser = {
  id: string
  email: string
  username: string
  fullName: string
  isAdmin: boolean
  verified: boolean
  createdAt: string
  lastSignInAt?: string
}

export type AdminBlock = {
  id: string
  blocker: string
  blockerEmail?: string
  blockerUsername?: string
  blocked: string
  blockedEmail?: string
  blockedUsername?: string
  reason: string
  createdAt: string
}

export type AppView = 'feed' | 'discover' | 'compose' | 'notifications' | 'messages' | 'profile' | 'moderation' | 'post' | 'comments'
