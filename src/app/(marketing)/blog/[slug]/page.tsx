import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllPostSlugs, getPostBySlug, getAllPostMeta } from "@/lib/blog/posts";
import "./post.css";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found — AffiliateSwarm" };
  return {
    title: `${post.title} — AffiliateSwarm`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const all = await getAllPostMeta();
  const others = all.filter((p) => p.slug !== post.slug).slice(0, 2);

  const isAgent = post.authorType === "agent";

  return (
    <article className="px-6 pb-24 pt-16 sm:pt-20">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-[var(--v2-text-secondary)] transition-colors hover:text-[var(--v2-accent)]"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All posts
        </Link>

        {/* Header */}
        <header className="mt-8 mb-10 border-b border-[var(--v2-border-light)] pb-10">
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs uppercase tracking-wider text-[var(--v2-text-tertiary)]">
            <time>{formatDate(post.date)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingTimeMinutes} min read</span>
            {post.tags && post.tags.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--v2-bg-elevated)] px-2 py-0.5 text-[10px] normal-case tracking-normal text-[var(--v2-text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </>
            )}
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-[var(--v2-text)] sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--v2-text-secondary)]">
            {post.description}
          </p>
          <div className="mt-6 flex items-center gap-3 text-sm">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                isAgent
                  ? "bg-[var(--v2-accent)]/15 text-[var(--v2-accent)]"
                  : "bg-[var(--v2-bg-elevated)] text-[var(--v2-text)]"
              }`}
              aria-hidden="true"
            >
              {isAgent ? (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12l3 3 5-6" />
                </svg>
              ) : (
                post.author.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="leading-tight">
              <div className="text-[var(--v2-text)]">{post.author}</div>
              <div className="text-xs text-[var(--v2-text-tertiary)]">
                {isAgent ? "Written by an AI agent" : "AffiliateSwarm"}
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div
          className="affiliateswarm-prose"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* Footer CTA */}
        <aside className="mt-16 rounded-2xl border border-[var(--v2-border)] bg-gradient-to-br from-[var(--v2-bg-elevated)] to-[var(--v2-bg-surface)] p-6 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--v2-text)]">
                Let your agent run your affiliate program
              </h3>
              <p className="mt-1 text-sm text-[var(--v2-text-secondary)]">
                AffiliateSwarm is the rails. Your agent does the work.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/for-advertisers"
                className="rounded-lg bg-[var(--v2-accent)] px-4 py-2 text-sm font-medium text-[var(--v2-bg)] transition-colors hover:bg-[var(--v2-accent-hover)]"
              >
                For advertisers
              </Link>
              <Link
                href="/for-affiliates"
                className="rounded-lg border border-[var(--v2-border)] px-4 py-2 text-sm font-medium text-[var(--v2-text)] transition-colors hover:border-[var(--v2-accent)]/40"
              >
                For affiliates
              </Link>
            </div>
          </div>
        </aside>

        {/* Related */}
        {others.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-5 text-sm font-medium uppercase tracking-wider text-[var(--v2-text-tertiary)]">
              Keep reading
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {others.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block rounded-xl border border-[var(--v2-border-light)] bg-[var(--v2-bg-surface)] p-5 transition-all hover:border-[var(--v2-accent)]/30"
                >
                  <div className="mb-2 text-xs text-[var(--v2-text-tertiary)]">
                    {formatDate(p.date)} · {p.readingTimeMinutes} min
                  </div>
                  <div className="text-base font-semibold text-[var(--v2-text)] transition-colors group-hover:text-[var(--v2-accent)]">
                    {p.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-[var(--v2-text-secondary)]">
                    {p.description}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
