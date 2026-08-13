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
}

export type Post = {
  id: string
  author: Profile
  body: string
  imageUrl?: string
  createdAt: string
  likes: number
  liked: boolean
  comments: Comment[]
  visibility: 'public' | 'followers'
}

export type Notice = {
  id: string
  kind: 'like' | 'comment' | 'follow' | 'system'
  actor?: Profile
  text: string
  createdAt: string
  read: boolean
}

export type Report = {
  id: string
  reporter: string
  reason: string
  postId: string
  excerpt: string
  status: 'open' | 'reviewed' | 'removed'
  createdAt: string
}

export type AppView = 'feed' | 'discover' | 'compose' | 'notifications' | 'profile' | 'moderation' | 'comments'
