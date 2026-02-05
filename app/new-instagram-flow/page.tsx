'use client';

import { type FormEvent, useMemo, useState } from 'react';
import type { FeedRunResult } from '@/lib/services/instagram-feed';
import { isNumber, isString, toRecord } from '@/lib/utils/type-guards';

interface FeedResponse {
	ok: boolean;
	data?: FeedRunResult;
	error?: string;
}

const isFeedRunResult = (value: unknown): value is FeedRunResult => {
	const record = toRecord(value);
	if (!record) {
		return false;
	}
	return (
		isString(record.keyword) &&
		isString(record.generatedAt) &&
		isNumber(record.creatorsConsidered) &&
		isNumber(record.candidatesScored) &&
		Array.isArray(record.items)
	);
};

const parseFeedResponse = (value: unknown): FeedResponse | null => {
	const record = toRecord(value);
	if (!record || typeof record.ok !== 'boolean') {
		return null;
	}
	const response: FeedResponse = { ok: record.ok };
	if (isString(record.error)) {
		response.error = record.error;
	}
	if (record.data && isFeedRunResult(record.data)) {
		response.data = record.data;
	}
	return response;
};

export default function NewInstagramFlowPage() {
	const [keyword, setKeyword] = useState('nutritionists');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<FeedRunResult | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const res = await fetch('/api/new-instagram-flow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ keyword }),
			});
			const raw = await res.json();
			const data = parseFeedResponse(raw);
			if (!data) {
				throw new Error('Unexpected response from feed API');
			}
			if (!(data.ok && data.data)) {
				throw new Error(data.error ?? 'Feed generation failed');
			}
			setResult(data.data);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unexpected error';
			setError(message);
		} finally {
			setLoading(false);
		}
	}

	const summary = useMemo(() => {
		if (!result) {
			return null;
		}
		return `Created ${result.items.length} reels from ${result.creatorsConsidered} creators`;
	}, [result]);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
			<header className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold">Instagram Discovery Sandbox</h1>
				<p className="text-sm text-muted-foreground">
					Run the Influencers Club discovery → enrich → reel details pipeline for a keyword. Results
					are cached per request only.
				</p>
			</header>

			<form
				onSubmit={handleSubmit}
				className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
			>
				<label className="text-sm font-medium" htmlFor="keyword">
					Keyword
				</label>
				<input
					id="keyword"
					name="keyword"
					value={keyword}
					onChange={(event) => setKeyword(event.target.value)}
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="nutritionists"
				/>
				<button
					type="submit"
					disabled={loading}
					className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
				>
					{loading ? 'Running…' : 'Generate feed'}
				</button>
			</form>

			{error ? (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
					{error}
				</div>
			) : null}

			{summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}

			{result ? (
				<section className="grid gap-4">
					{result.items.map((item) => (
						<article
							key={item.postId}
							className="rounded-lg border border-border bg-card p-4 shadow-sm"
						>
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<p className="text-xs uppercase tracking-wide text-muted-foreground">
										@{item.creator.username}
									</p>
									<h2 className="text-xl font-semibold">
										{item.creator.fullName ?? item.creator.username}
									</h2>
									<p className="text-sm text-muted-foreground">
										{formatDate(item.createdAt)} •{' '}
										{Intl.NumberFormat(undefined, { notation: 'compact' }).format(
											item.metrics.plays
										)}{' '}
										plays
									</p>
								</div>
								<div className="text-right text-xs text-muted-foreground">
									<p>Score: {item.score.toFixed(2)}</p>
									<p>Followers: {formatNumber(item.creator.followers)}</p>
									<p>ER: {item.creator.engagementPercent?.toFixed(2) ?? '—'}%</p>
								</div>
							</div>

							<p className="mt-3 line-clamp-4 text-sm">{item.caption ?? 'No caption available.'}</p>

							{item.keywordHits.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2 text-xs text-primary">
									{item.keywordHits.map((hit) => (
										<span key={hit} className="rounded-full border border-primary/40 px-2 py-1">
											{hit}
										</span>
									))}
								</div>
							) : null}

							<div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
								<Metric label="Likes" value={item.metrics.likes} />
								<Metric label="Comments" value={item.metrics.comments} />
								<Metric label="Shares" value={item.metrics.shares} />
								<Metric label="Avg Likes" value={item.creator.avgLikes} />
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
								{item.postUrl ? (
									<a className="underline" href={item.postUrl} target="_blank" rel="noreferrer">
										View on Instagram
									</a>
								) : null}
								{item.audioUrl ? (
									<a className="underline" href={item.audioUrl} target="_blank" rel="noreferrer">
										Audio download
									</a>
								) : null}
								{item.transcript ? (
									<span>Transcript length: {item.transcript.length} chars</span>
								) : (
									<span>No transcript available</span>
								)}
								{item.musicTitle ? <span>Track: {item.musicTitle}</span> : null}
							</div>

							{item.transcript ? (
								<details className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground">
									<summary className="cursor-pointer text-xs font-medium uppercase tracking-wide">
										Transcript
									</summary>
									<p className="mt-2 whitespace-pre-wrap">{item.transcript}</p>
								</details>
							) : null}
						</article>
					))}
				</section>
			) : null}
		</div>
	);
}

function Metric({ label, value }: { label: string; value?: number }) {
	return (
		<div className="flex flex-col">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value !== undefined ? formatNumber(value) : '—'}</span>
		</div>
	);
}

function formatNumber(value?: number) {
	if (!value && value !== 0) {
		return '—';
	}
	return Intl.NumberFormat(undefined, { notation: 'compact' }).format(value);
}

function formatDate(dateString: string) {
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return 'Unknown date';
	}
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
