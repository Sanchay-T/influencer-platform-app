// Definimos un mapa de colores pasteles por categoría
export const categoryColors = {
	Basketball: '#FFB5B5', // Rosa pastel
	Sports: '#B5D8FF', // Azul pastel
	Lifestyle: '#FFE4B5', // Melocotón pastel
	Family: '#D7FFB5', // Verde lima pastel
	Fashion: '#E5B5FF', // Púrpura pastel
	Music: '#B5FFE4', // Turquesa pastel
	Gaming: '#FFB5E5', // Rosa fuerte pastel
	Comedy: '#B5FFFF', // Cyan pastel
};

export const mockNBACreators = [
	{
		username: 'kingjames',
		name: 'LeBron James',
		platform: 'instagram',
		followers: '158M',
		engagement: '4.2%',
		location: 'Los Angeles, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '95%',
	},
	{
		username: 'giannis_an34',
		name: 'Giannis Antetokounmpo',
		platform: 'instagram',
		followers: '65M',
		engagement: '3.8%',
		location: 'Milwaukee, USA',
		categories: ['Basketball', 'Sports', 'Family'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '92%',
	},
	{
		username: 'kevindurant',
		name: 'Kevin Durant',
		platform: 'instagram',
		followers: '89M',
		engagement: '3.5%',
		location: 'Phoenix, USA',
		categories: ['Basketball', 'Sports', 'Fashion'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '88%',
	},
	{
		username: 'jamorant',
		name: 'Ja Morant',
		platform: 'instagram',
		followers: '42M',
		engagement: '4.8%',
		location: 'Memphis, USA',
		categories: ['Basketball', 'Sports', 'Music'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '85%',
	},
	{
		username: 'luka7doncic',
		name: 'Luka Dončić',
		platform: 'instagram',
		followers: '35M',
		engagement: '4.1%',
		location: 'Dallas, USA',
		categories: ['Basketball', 'Sports', 'Gaming'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '82%',
	},
	{
		username: 'stephencurry30',
		name: 'Stephen Curry',
		platform: 'instagram',
		followers: '45M',
		engagement: '5.0%',
		location: 'San Francisco, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '90%',
	},
	{
		username: 'kyrieirving',
		name: 'Kyrie Irving',
		platform: 'instagram',
		followers: '20M',
		engagement: '4.5%',
		location: 'Brooklyn, USA',
		categories: ['Basketball', 'Sports', 'Fashion'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '87%',
	},
	{
		username: 'russwest44',
		name: 'Russell Westbrook',
		platform: 'instagram',
		followers: '14M',
		engagement: '3.9%',
		location: 'Los Angeles, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '84%',
	},
	{
		username: 'jason_tatum',
		name: 'Jayson Tatum',
		platform: 'instagram',
		followers: '10M',
		engagement: '4.3%',
		location: 'Boston, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '86%',
	},
	{
		username: 'damianlillard',
		name: 'Damian Lillard',
		platform: 'instagram',
		followers: '8M',
		engagement: '4.0%',
		location: 'Portland, USA',
		categories: ['Basketball', 'Sports', 'Music'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '83%',
	},
	{
		username: 'paulgeorge',
		name: 'Paul George',
		platform: 'instagram',
		followers: '9M',
		engagement: '3.7%',
		location: 'Los Angeles, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '81%',
	},
	{
		username: 'chrisbosh',
		name: 'Chris Bosh',
		platform: 'instagram',
		followers: '5M',
		engagement: '3.2%',
		location: 'Miami, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '80%',
	},
	{
		username: 'dwyanewade',
		name: 'Dwyane Wade',
		platform: 'instagram',
		followers: '17M',
		engagement: '4.4%',
		location: 'Miami, USA',
		categories: ['Basketball', 'Sports', 'Fashion'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '89%',
	},
	{
		username: 'carmeloanthony',
		name: 'Carmelo Anthony',
		platform: 'instagram',
		followers: '10M',
		engagement: '3.6%',
		location: 'Los Angeles, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '82%',
	},
	{
		username: 'kevinlove',
		name: 'Kevin Love',
		platform: 'instagram',
		followers: '8M',
		engagement: '3.8%',
		location: 'Cleveland, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '79%',
	},
	{
		username: 'blakegriffin23',
		name: 'Blake Griffin',
		platform: 'instagram',
		followers: '5M',
		engagement: '3.1%',
		location: 'Los Angeles, USA',
		categories: ['Basketball', 'Sports', 'Comedy'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '78%',
	},
	{
		username: 'zachlavine',
		name: 'Zach LaVine',
		platform: 'instagram',
		followers: '6M',
		engagement: '4.0%',
		location: 'Chicago, USA',
		categories: ['Basketball', 'Sports', 'Lifestyle'].map((category) => ({
			name: category,
			color: categoryColors[category],
		})),
		similarityScore: '77%',
	},
];
