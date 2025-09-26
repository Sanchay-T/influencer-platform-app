const keywordColors = {
  Music: '#FF8FA3', // Rosa pastel vibrante
  Dance: '#FFA559', // Naranja pastel suave
  Sports: '#7FB5FF', // Azul pastel equilibrado
  Fitness: '#72D572', // Verde menta pastel
  Beauty: '#FF97A8', // Coral pastel
  Fashion: '#FFB085', // Durazno pastel
  Acting: '#87DFD6', // Verde menta pastel
  Comedy: '#FFE08A', // Amarillo miel pastel
};

export const fakeData = [
  {
    profile: {
      photo: 'url_de_foto_de_perfil_1',
      name: 'Bad Bunny',
      username: '@badbunny'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 1000000,
    totalViews: 5000000,
    followers: 2000000,
    region: 'US',
    videos: 150,
    link: 'https://instagram.com/badbunny',
    bio: 'Latin trap and reggaeton artist',
    email: 'contact@badbunny.com',
    following: 500,
    accountAge: '5 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_2',
      name: 'Charli D\'Amelio',
      username: '@charlidamelio'
    },
    keywords: 'Dance',
    color: keywordColors['Dance'],
    platform: 'TikTok',
    totalLikes: 2000000,
    totalViews: 10000000,
    followers: 3000000,
    region: 'CA',
    videos: 200,
    link: 'https://tiktok.com/@charlidamelio',
    bio: 'Dancer and social media personality',
    email: 'contact@charlidamelio.com',
    following: 1000,
    accountAge: '3 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_3',
      name: 'Cristiano Ronaldo',
      username: '@cristiano'
    },
    keywords: 'Sports',
    color: keywordColors['Sports'],
    platform: 'Instagram',
    totalLikes: 5000000,
    totalViews: 20000000,
    followers: 250000000,
    region: 'EU',
    videos: 300,
    link: 'https://instagram.com/cristiano',
    bio: 'Professional footballer',
    email: 'contact@cristiano.com',
    following: 300,
    accountAge: '10 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_4',
      name: 'Selena Gomez',
      username: '@selenagomez'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 3000000,
    totalViews: 15000000,
    followers: 200000000,
    region: 'US',
    videos: 100,
    link: 'https://instagram.com/selenagomez',
    bio: 'Singer and actress',
    email: 'contact@selenagomez.com',
    following: 400,
    accountAge: '12 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_5',
      name: 'Dwayne Johnson',
      username: '@therock'
    },
    keywords: 'Fitness',
    color: keywordColors['Fitness'],
    platform: 'Instagram',
    totalLikes: 7000000,
    totalViews: 30000000,
    followers: 300000000,
    region: 'US',
    videos: 250,
    link: 'https://instagram.com/therock',
    bio: 'Actor and former professional wrestler',
    email: 'contact@therock.com',
    following: 200,
    accountAge: '8 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_6',
      name: 'Ariana Grande',
      username: '@arianagrande'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4000000,
    totalViews: 25000000,
    followers: 220000000,
    region: 'US',
    videos: 120,
    link: 'https://instagram.com/arianagrande',
    bio: 'Singer and songwriter',
    email: 'contact@arianagrande.com',
    following: 350,
    accountAge: '9 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_7',
      name: 'Kylie Jenner',
      username: '@kyliejenner'
    },
    keywords: 'Beauty',
    color: keywordColors['Beauty'],
    platform: 'Instagram',
    totalLikes: 6000000,
    totalViews: 35000000,
    followers: 280000000,
    region: 'US',
    videos: 180,
    link: 'https://instagram.com/kyliejenner',
    bio: 'Entrepreneur and reality TV star',
    email: 'contact@kyliejenner.com',
    following: 450,
    accountAge: '11 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_8',
      name: 'Lionel Messi',
      username: '@leomessi'
    },
    keywords: 'Sports',
    color: keywordColors['Sports'],
    platform: 'Instagram',
    totalLikes: 5500000,
    totalViews: 28000000,
    followers: 240000000,
    region: 'EU',
    videos: 220,
    link: 'https://instagram.com/leomessi',
    bio: 'Professional footballer',
    email: 'contact@leomessi.com',
    following: 250,
    accountAge: '7 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_9',
      name: 'Kim Kardashian',
      username: '@kimkardashian'
    },
    keywords: 'Fashion',
    color: keywordColors['Fashion'],
    platform: 'Instagram',
    totalLikes: 5000000,
    totalViews: 30000000,
    followers: 260000000,
    region: 'US',
    videos: 200,
    link: 'https://instagram.com/kimkardashian',
    bio: 'Reality TV star and entrepreneur',
    email: 'contact@kimkardashian.com',
    following: 500,
    accountAge: '13 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_10',
      name: 'Beyoncé',
      username: '@beyonce'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4500000,
    totalViews: 22000000,
    followers: 210000000,
    region: 'US',
    videos: 90,
    link: 'https://instagram.com/beyonce',
    bio: 'Singer and songwriter',
    email: 'contact@beyonce.com',
    following: 150,
    accountAge: '10 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_11',
      name: 'Taylor Swift',
      username: '@taylorswift'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4800000,
    totalViews: 24000000,
    followers: 230000000,
    region: 'US',
    videos: 110,
    link: 'https://instagram.com/taylorswift',
    bio: 'Singer and songwriter',
    email: 'contact@taylorswift.com',
    following: 300,
    accountAge: '11 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_12',
      name: 'Justin Bieber',
      username: '@justinbieber'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 5200000,
    totalViews: 26000000,
    followers: 240000000,
    region: 'CA',
    videos: 130,
    link: 'https://instagram.com/justinbieber',
    bio: 'Singer and songwriter',
    email: 'contact@justinbieber.com',
    following: 400,
    accountAge: '12 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_13',
      name: 'Kendall Jenner',
      username: '@kendalljenner'
    },
    keywords: 'Fashion',
    color: keywordColors['Fashion'],
    platform: 'Instagram',
    totalLikes: 4700000,
    totalViews: 23000000,
    followers: 220000000,
    region: 'US',
    videos: 140,
    link: 'https://instagram.com/kendalljenner',
    bio: 'Model and reality TV star',
    email: 'contact@kendalljenner.com',
    following: 350,
    accountAge: '10 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_14',
      name: 'Drake',
      username: '@champagnepapi'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4900000,
    totalViews: 25000000,
    followers: 210000000,
    region: 'CA',
    videos: 160,
    link: 'https://instagram.com/champagnepapi',
    bio: 'Rapper and singer',
    email: 'contact@drake.com',
    following: 300,
    accountAge: '9 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_15',
      name: 'Rihanna',
      username: '@badgalriri'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4600000,
    totalViews: 24000000,
    followers: 200000000,
    region: 'US',
    videos: 100,
    link: 'https://instagram.com/badgalriri',
    bio: 'Singer and entrepreneur',
    email: 'contact@rihanna.com',
    following: 250,
    accountAge: '11 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_16',
      name: 'Zendaya',
      username: '@zendaya'
    },
    keywords: 'Acting',
    color: keywordColors['Acting'],
    platform: 'Instagram',
    totalLikes: 4400000,
    totalViews: 22000000,
    followers: 190000000,
    region: 'US',
    videos: 90,
    link: 'https://instagram.com/zendaya',
    bio: 'Actress and singer',
    email: 'contact@zendaya.com',
    following: 200,
    accountAge: '8 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_17',
      name: 'Billie Eilish',
      username: '@billieeilish'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4300000,
    totalViews: 21000000,
    followers: 180000000,
    region: 'US',
    videos: 80,
    link: 'https://instagram.com/billieeilish',
    bio: 'Singer and songwriter',
    email: 'contact@billieeilish.com',
    following: 150,
    accountAge: '6 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_18',
      name: 'Katy Perry',
      username: '@katyperry'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4200000,
    totalViews: 20000000,
    followers: 170000000,
    region: 'US',
    videos: 70,
    link: 'https://instagram.com/katyperry',
    bio: 'Singer and songwriter',
    email: 'contact@katyperry.com',
    following: 100,
    accountAge: '10 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_19',
      name: 'Jennifer Lopez',
      username: '@jlo'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4100000,
    totalViews: 19000000,
    followers: 160000000,
    region: 'US',
    videos: 60,
    link: 'https://instagram.com/jlo',
    bio: 'Singer, actress, and dancer',
    email: 'contact@jlo.com',
    following: 50,
    accountAge: '9 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_20',
      name: 'Shakira',
      username: '@shakira'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 4000000,
    totalViews: 18000000,
    followers: 150000000,
    region: 'CO',
    videos: 50,
    link: 'https://instagram.com/shakira',
    bio: 'Singer and songwriter',
    email: 'contact@shakira.com',
    following: 40,
    accountAge: '8 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_21',
      name: 'Neymar Jr',
      username: '@neymarjr'
    },
    keywords: 'Sports',
    color: keywordColors['Sports'],
    platform: 'Instagram',
    totalLikes: 3900000,
    totalViews: 17000000,
    followers: 140000000,
    region: 'BR',
    videos: 40,
    link: 'https://instagram.com/neymarjr',
    bio: 'Professional footballer',
    email: 'contact@neymarjr.com',
    following: 30,
    accountAge: '7 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_22',
      name: 'Cardi B',
      username: '@iamcardib'
    },
    keywords: 'Music',
    color: keywordColors['Music'],
    platform: 'Instagram',
    totalLikes: 3800000,
    totalViews: 16000000,
    followers: 130000000,
    region: 'US',
    videos: 30,
    link: 'https://instagram.com/iamcardib',
    bio: 'Rapper and singer',
    email: 'contact@cardib.com',
    following: 20,
    accountAge: '6 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_23',
      name: 'Ellen DeGeneres',
      username: '@ellendegeneres'
    },
    keywords: 'Comedy',
    color: keywordColors['Comedy'],
    platform: 'Instagram',
    totalLikes: 3700000,
    totalViews: 15000000,
    followers: 120000000,
    region: 'US',
    videos: 20,
    link: 'https://instagram.com/ellendegeneres',
    bio: 'Comedian and TV host',
    email: 'contact@ellendegeneres.com',
    following: 10,
    accountAge: '5 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_24',
      name: 'Kevin Hart',
      username: '@kevinhart4real'
    },
    keywords: 'Comedy',
    color: keywordColors['Comedy'],
    platform: 'Instagram',
    totalLikes: 3600000,
    totalViews: 14000000,
    followers: 110000000,
    region: 'US',
    videos: 10,
    link: 'https://instagram.com/kevinhart4real',
    bio: 'Comedian and actor',
    email: 'contact@kevinhart.com',
    following: 5,
    accountAge: '4 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_25',
      name: 'LeBron James',
      username: '@kingjames'
    },
    keywords: 'Sports',
    color: keywordColors['Sports'],
    platform: 'Instagram',
    totalLikes: 3500000,
    totalViews: 13000000,
    followers: 100000000,
    region: 'US',
    videos: 5,
    link: 'https://instagram.com/kingjames',
    bio: 'Professional basketball player',
    email: 'contact@lebronjames.com',
    following: 2,
    accountAge: '3 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_26',
      name: 'Virat Kohli',
      username: '@virat.kohli'
    },
    keywords: 'Sports',
    color: keywordColors['Sports'],
    platform: 'Instagram',
    totalLikes: 3400000,
    totalViews: 12000000,
    followers: 90000000,
    region: 'IN',
    videos: 4,
    link: 'https://instagram.com/virat.kohli',
    bio: 'Professional cricketer',
    email: 'contact@viratkohli.com',
    following: 1,
    accountAge: '2 years'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_27',
      name: 'Priyanka Chopra',
      username: '@priyankachopra'
    },
    keywords: 'Acting',
    color: keywordColors['Acting'],
    platform: 'Instagram',
    totalLikes: 3300000,
    totalViews: 11000000,
    followers: 80000000,
    region: 'IN',
    videos: 3,
    link: 'https://instagram.com/priyankachopra',
    bio: 'Actress and model',
    email: 'contact@priyankachopra.com',
    following: 0,
    accountAge: '1 year'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_28',
      name: 'Deepika Padukone',
      username: '@deepikapadukone'
    },
    keywords: 'Fashion',
    color: keywordColors['Fashion'],
    platform: 'Instagram',
    totalLikes: 3200000,
    totalViews: 10000000,
    followers: 70000000,
    region: 'IN',
    videos: 2,
    link: 'https://instagram.com/deepikapadukone',
    bio: 'Actress and model',
    email: 'contact@deepikapadukone.com',
    following: 0,
    accountAge: '1 year'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_29',
      name: 'Ranveer Singh',
      username: '@ranveersingh'
    },
    keywords: 'Fashion',
    color: keywordColors['Fashion'],
    platform: 'Instagram',
    totalLikes: 3100000,
    totalViews: 9000000,
    followers: 60000000,
    region: 'IN',
    videos: 1,
    link: 'https://instagram.com/ranveersingh',
    bio: 'Actor and model',
    email: 'contact@ranveersingh.com',
    following: 0,
    accountAge: '1 year'
  },
  {
    profile: {
      photo: 'url_de_foto_de_perfil_30',
      name: 'Alia Bhatt',
      username: '@aliaabhatt'
    },
    keywords: 'Acting',
    color: keywordColors['Acting'],
    platform: 'Instagram',
    totalLikes: 3000000,
    totalViews: 8000000,
    followers: 50000000,
    region: 'IN',
    videos: 0,
    link: 'https://instagram.com/aliaabhatt',
    bio: 'Actress and model',
    email: 'contact@aliaabhatt.com',
    following: 0,
    accountAge: '1 year'
  },
]; 