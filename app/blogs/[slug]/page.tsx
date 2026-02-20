import { redirect } from 'next/navigation';

interface BlogsSlugRedirectPageProps {
	params: Promise<{ slug: string }>;
}

export default async function BlogsSlugRedirectPage({ params }: BlogsSlugRedirectPageProps) {
	const { slug } = await params;
	redirect(`/blog/${slug}`);
}
