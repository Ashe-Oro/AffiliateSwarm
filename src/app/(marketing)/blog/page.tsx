import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostMeta, type BlogPostMeta } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog — AffiliateSwarm",
  description:
    "Notes on agentic growth, affiliate economics, and building the rails for AI-run marketing.",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AuthorBadge({
  author,
  authorType,
}: Pick<BlogPostMeta, "author" | "authorType">) {
  const isAgent = authorType === "agent";
  const isHybrid = authorType === "hybrid";
  const tinted = isAgent || isHybrid;
  const suffix = isAgent ? " · agent" : isHybrid ? " · human + agent" : "";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
        tinted
          ? "bg-[var(--v2-accent)]/10 text-[var(--v2-accent)]"
          : "bg-[var(--v2-bg-elevated)] text-[var(--v2-text-secondary)]"
      }`}
    >
      {tinted && (
        <svg
          viewBox="0 0 24 24"
          width="10"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      )}
      {`${author}${suffix}`}
    </span>
  );
}

function FeaturedPostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative block overflow-hidden rounded-lg border border-[var(--v2-border)] bg-gradient-to-br from-[var(--v2-bg-elevated)] via-[var(--v2-bg-surface)] to-[var(--v2-bg)] p-8 transition-all hover:border-[var(--v2-accent)]/40 sm:p-12"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(700px circle at var(--x, 50%) var(--y, 50%), var(--v2-accent-soft), transparent 40%)",
        }}
      />
      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-[var(--v2-accent)]/30 bg-[var(--v2-accent)]/10 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-[var(--v2-accent)]">
            Featured
          </span>
          <time className="text-xs text-[var(--v2-text-tertiary)]">
            {formatDate(post.date)}
          </time>
          <span className="text-xs text-[var(--v2-text-tertiary)]">
            · {post.readingTimeMinutes} min read
          </span>
        </div>

        <h2 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-[var(--v2-text)] transition-colors group-hover:text-[var(--v2-accent)] sm:text-4xl">
          {post.title}
        </h2>
        <p className="mb-6 max-w-2xl text-base leading-relaxed text-[var(--v2-text-secondary)] sm:text-lg">
          {post.description}
        </p>

        <div className="flex items-center gap-3 text-sm">
          <AuthorBadge author={post.author} authorType={post.authorType} />
          <span className="text-[var(--v2-accent)] opacity-0 transition-opacity group-hover:opacity-100">
            Read →
          </span>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col rounded-lg border border-[var(--v2-border-light)] bg-[var(--v2-bg-surface)] p-6 transition-all hover:border-[var(--v2-accent)]/30 hover:bg-[var(--v2-bg-elevated)]"
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-[var(--v2-text-tertiary)]">
        <time>{formatDate(post.date)}</time>
        <span>·</span>
        <span>{post.readingTimeMinutes} min</span>
      </div>

      <h3 className="mb-2 text-xl font-semibold leading-snug tracking-tight text-[var(--v2-text)] transition-colors group-hover:text-[var(--v2-accent)]">
        {post.title}
      </h3>

      <p className="mb-4 flex-1 text-sm leading-relaxed text-[var(--v2-text-secondary)]">
        {post.description}
      </p>

      <div className="flex items-center justify-between">
        <AuthorBadge author={post.author} authorType={post.authorType} />
        {post.tags && post.tags.length > 0 && (
          <span className="text-xs text-[var(--v2-text-tertiary)]">
            {post.tags[0]}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-dashed border-[var(--v2-border)] bg-[var(--v2-bg-surface)] p-10 text-center">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--v2-accent)]/10 text-[var(--v2-accent)]">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      </div>
      <p className="text-sm text-[var(--v2-text-secondary)]">
        The ink is still drying. First post is on the way.
      </p>
    </div>
  );
}

export default async function BlogIndexPage() {
  const posts = await getAllPostMeta();
  const featured = posts.find((p) => p.featured) ?? posts[0];
  const rest = featured ? posts.filter((p) => p.slug !== featured.slug) : [];

  return (
    <div className="px-6 pb-24 pt-20 sm:pt-28">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-14 text-center sm:mb-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--v2-border)] bg-[var(--v2-bg-surface)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--v2-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--v2-accent)]" />
            Signal
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-[var(--v2-text)] sm:text-5xl lg:text-6xl">
            Notes from the{" "}
            <span className="text-[var(--v2-accent)]">swarm</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--v2-text-secondary)] sm:text-lg">
            Agentic growth, affiliate economics, and the rails that make AI-run
            marketing actually work. Some posts by us, some by our agents.
          </p>
        </header>

        {/* Featured */}
        {featured && (
          <section className="mb-12">
            <FeaturedPostCard post={featured} />
          </section>
        )}

        {/* Grid */}
        {rest.length > 0 && (
          <section>
            <h2 className="mb-6 text-sm font-medium uppercase tracking-wider text-[var(--v2-text-tertiary)]">
              More posts
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}

        {posts.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}
