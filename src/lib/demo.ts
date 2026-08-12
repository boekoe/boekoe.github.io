import type { Notice, Post, Profile, Report } from '../types'

export const demoUser: Profile = {
  id: 'me', username: 'danielvv', fullName: 'Daniel van Vuuren',
  bio: 'Ondernemer, maker en trotse Surinamer 🇸🇷', location: 'Paramaribo',
  avatarUrl: 'https://i.pravatar.cc/240?img=12', followers: 248, following: 193, isAdmin: true,
}

export const people: Profile[] = [
  demoUser,
  { id: 'p1', username: 'amara.sr', fullName: 'Amara Kensenhuis', bio: 'Kunst, cultuur en een beetje chaos ✨', location: 'Paramaribo', avatarUrl: 'https://i.pravatar.cc/240?img=47', verified: true, followers: 1840, following: 381 },
  { id: 'p2', username: 'jaydenpara', fullName: 'Jayden Pinas', bio: 'Fotograaf • natuurmens • koffie', location: 'Commewijne', avatarUrl: 'https://i.pravatar.cc/240?img=68', followers: 926, following: 411 },
  { id: 'p3', username: 'tante_mien', fullName: 'Mien Adipi', bio: 'Familierecepten uit heel Suriname', location: 'Wanica', avatarUrl: 'https://i.pravatar.cc/240?img=44', followers: 5400, following: 205 },
  { id: 'p4', username: 'ravi.tech', fullName: 'Ravi Chand', bio: 'Software, startups en Suriname vooruit', location: 'Paramaribo', avatarUrl: 'https://i.pravatar.cc/240?img=15', verified: true, followers: 3220, following: 612 },
  { id: 'p5', username: 'alicia_nickerie', fullName: 'Alicia Wong', bio: 'Van het rijstdistrict 🌾', location: 'Nieuw-Nickerie', avatarUrl: 'https://i.pravatar.cc/240?img=32', followers: 744, following: 367 },
]

export const demoPosts: Post[] = [
  {
    id: 'post-1', author: people[1],
    body: 'Vanmorgen langs de Waterkant. Soms vergeet je hoe mooi onze stad kan zijn als het licht precies goed valt. 💚',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Downtown_Paramaribo_(23686298135).jpg?width=1200',
    createdAt: new Date(Date.now() - 25 * 60_000).toISOString(), likes: 128, liked: false, visibility: 'public',
    comments: [{ id: 'c1', author: people[2], body: 'Prachtig vastgelegd! 🔥', createdAt: new Date(Date.now() - 12 * 60_000).toISOString() }],
  },
  {
    id: 'post-2', author: people[4],
    body: 'Wie is er bezig met een eigen digitale onderneming? Ik organiseer zaterdag een gratis meet-up voor jonge makers. Geen mooie praatjes, gewoon ideeën delen en elkaar helpen. Drop een 🚀 als je erbij wilt zijn.',
    createdAt: new Date(Date.now() - 2.2 * 3_600_000).toISOString(), likes: 84, liked: true, visibility: 'public',
    comments: [
      { id: 'c2', author: demoUser, body: '🚀 Goed initiatief. Stuur me de locatie!', createdAt: new Date(Date.now() - 80 * 60_000).toISOString() },
      { id: 'c3', author: people[5], body: 'Kunnen we ook online aansluiten?', createdAt: new Date(Date.now() - 54 * 60_000).toISOString() },
    ],
  },
  {
    id: 'post-3', author: people[3],
    body: 'Vandaag pom gemaakt zoals mijn oma het deed. Het geheim? Geduld, goede pomtajer en nooit zuinig zijn met liefde. Het recept staat in de reacties 👇🏽',
    imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=84',
    createdAt: new Date(Date.now() - 5.5 * 3_600_000).toISOString(), likes: 311, liked: false, visibility: 'public', comments: [],
  },
  {
    id: 'post-4', author: people[5],
    body: 'De rijstvelden na de regen. Groeten uit Nickerie! 🌾🇸🇷',
    imageUrl: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1200&q=84',
    createdAt: new Date(Date.now() - 22 * 3_600_000).toISOString(), likes: 201, liked: false, visibility: 'public', comments: [],
  },
]

export const demoNotices: Notice[] = [
  { id: 'n1', kind: 'follow', actor: people[5], text: 'is je gaan volgen', createdAt: new Date(Date.now() - 18 * 60_000).toISOString(), read: false },
  { id: 'n2', kind: 'like', actor: people[1], text: 'vindt je bericht leuk', createdAt: new Date(Date.now() - 75 * 60_000).toISOString(), read: false },
  { id: 'n3', kind: 'comment', actor: people[4], text: 'reageerde: “Dit moeten we vaker doen!”', createdAt: new Date(Date.now() - 4 * 3_600_000).toISOString(), read: true },
  { id: 'n4', kind: 'system', text: 'Welkom bij Boekoe. Samen houden we het veilig en gezellig.', createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(), read: true },
]

export const demoReports: Report[] = [
  { id: 'r1', reporter: 'Alicia Wong', reason: 'Mogelijk misleidende informatie', postId: 'post-2', excerpt: 'Bericht gemeld ter controle door de community.', status: 'open', createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString() },
  { id: 'r2', reporter: 'Jayden Pinas', reason: 'Ongewenste reclame', postId: 'post-4', excerpt: 'Herhaald promotioneel bericht zonder context.', status: 'reviewed', createdAt: new Date(Date.now() - 28 * 3_600_000).toISOString() },
]
