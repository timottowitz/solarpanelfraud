import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Clock, ArrowLeft, User, Phone, MessageCircle } from 'lucide-react';
import { loadBlogPost, getRelatedPosts } from '@/utils/blogUtils';
import CTASection from '@/components/ui/cta-section';
import AudioStory from '@/components/ui/audio-story';
import TableOfContents from '@/components/blog/TableOfContents';
import ShareButtons from '@/components/blog/ShareButtons';
import { Card, CardContent } from '@/components/ui/card';
import { DEFAULTS, getOrigin, toAbsoluteUrl } from '@/lib/seo';
import { getAllPostsMeta } from '@/lib/content';
import HubList from '@/components/blog/HubList';
import SeeAlso from '@/components/blog/SeeAlso';

interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  author: string;
  featured?: boolean;
  tags?: string[];
  canonical?: string;
  noindex?: boolean;
  updatedDate?: string;
  heroImage?: string;
}

// Author information for schema and display
const AUTHOR_INFO = {
  name: "Charles Bennett, Bennett Legal",
  bio: "Experienced consumer protection attorney specializing in solar fraud cases and helping victims recover from scams. Over 15 years helping Texans fight fraudulent solar companies and recover their losses.",
  url: window.location.origin + "/about"
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<string>("");
  const [postMeta, setPostMeta] = useState<BlogPostMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPost = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        const result = await loadBlogPost(slug);
        if (result) {
          setContent(result.content);
          setPostMeta(result.metadata);
        }
      } catch (error) {
        console.error('Failed to load blog post:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!postMeta || !content) {
    return <Navigate to="/blog" replace />;
  }

  const origin = getOrigin();
  const articleUrl = (postMeta as any).canonical || `${origin}/blog/${slug}`;
  const relatedPosts = getRelatedPosts(postMeta.slug, 3);

  // Prev/Next by publish date (newest first index)
  const { prevPost, nextPost } = useMemo(() => {
    const all = getAllPostsMeta();
    const idx = all.findIndex(p => p.slug === postMeta.slug);
    return {
      prevPost: idx >= 0 && idx + 1 < all.length ? all[idx + 1] : null, // older
      nextPost: idx > 0 ? all[idx - 1] : null // newer
    };
  }, [postMeta.slug]);

  const ogImage = toAbsoluteUrl((postMeta as any).heroImage) || `${origin}/og/${postMeta.slug}.png`;
  const robots = (postMeta as any).noindex ? 'noindex,follow' : 'index,follow';
  const tags = (postMeta as any).tags || [];
  const keywords = tags.join(', ');

  // Structured data for article
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": postMeta.title,
    "description": postMeta.excerpt,
    "datePublished": postMeta.date,
    "dateModified": postMeta.date,
    "author": {
      "@type": "Person",
      "name": AUTHOR_INFO.name,
      "description": AUTHOR_INFO.bio,
      "url": AUTHOR_INFO.url
    },
    "publisher": {
      "@type": "Organization",
      "name": "Bennett Legal",
      "url": window.location.origin
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": articleUrl
    },
    "articleSection": postMeta.category,
    "wordCount": content.split(' ').length
  };

  // Extract FAQ from content when a section starts with ## FAQ(S)
  const faqs = useMemo(() => {
    const m = content.match(/\n##\s*FAQ[s]?\s*\n([\s\S]*)/i);
    if (!m) return [] as { q: string; a: string }[];
    const faqBody = m[1];
    const parts = faqBody.split(/\n##\s+/)[0]; // stop at next H2
    const qa: { q: string; a: string }[] = [];
    const regex = /\n###\s+([^\n]+)\n([\s\S]*?)(?=\n###\s+|$)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(parts)) !== null) {
      const q = match[1].trim();
      const a = match[2].trim();
      if (q && a) qa.push({ q, a });
    }
    return qa;
  }, [content]);

  return (
    <>
      <Helmet>
        <title>{postMeta.title} | {DEFAULTS.siteName}</title>
        <meta name="description" content={postMeta.excerpt} />
        <meta name="keywords" content={keywords} />
        <meta name="author" content={AUTHOR_INFO.name} />
        <meta name="robots" content={robots} />
        <link rel="canonical" href={articleUrl} />

        {/* Open Graph */}
        <meta property="og:site_name" content={DEFAULTS.siteName} />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content={postMeta.title} />
        <meta property="og:description" content={postMeta.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={postMeta.title} />
        <meta property="article:published_time" content={postMeta.date} />
        <meta property="article:modified_time" content={(postMeta as any).updatedDate || postMeta.date} />
        <meta property="article:author" content={postMeta.author} />
        <meta property="article:section" content={postMeta.category} />
        {tags.map((t: string) => (
          <meta key={t} property="article:tag" content={t} />
        ))}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        {DEFAULTS.twitterSite && <meta name="twitter:site" content={DEFAULTS.twitterSite} />}
        <meta name="twitter:title" content={postMeta.title} />
        <meta name="twitter:description" content={postMeta.excerpt} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content={postMeta.title} />

        {/* Structured Data: Article */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": postMeta.title,
            "description": postMeta.excerpt,
            "datePublished": postMeta.date,
            "dateModified": (postMeta as any).updatedDate || postMeta.date,
            "author": {
              "@type": "Person",
              "name": AUTHOR_INFO.name,
              "description": AUTHOR_INFO.bio,
              "url": AUTHOR_INFO.url
            },
            "publisher": {
              "@type": "Organization",
              "name": DEFAULTS.siteName,
              "url": origin
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": articleUrl
            },
            "articleSection": postMeta.category,
            "keywords": tags,
            "image": ogImage,
            "url": articleUrl
          })}
        </script>

        {/* Structured Data: Breadcrumbs */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": origin },
              { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${origin}/blog` },
              { "@type": "ListItem", "position": 3, "name": postMeta.title, "item": articleUrl }
            ]
          })}
        </script>
        {faqs.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqs.map(f => ({
                "@type": "Question",
                "name": f.q,
                "acceptedAnswer": { "@type": "Answer", "text": f.a }
              }))
            })}
          </script>
        )}
        {/* Prev/Next link tags */}
        {prevPost && <link rel="prev" href={`${origin}/blog/${prevPost.slug}`} />}
        {nextPost && <link rel="next" href={`${origin}/blog/${nextPost.slug}`} />}
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back to Blog */}
          <Link to="/blog" className="inline-flex items-center text-primary hover:text-primary/80 mb-8 group">
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to Blog
          </Link>

          {/* Article Header */}
          <article>
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                <Badge variant="secondary">{postMeta.category}</Badge>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(postMeta.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{postMeta.readTime}</span>
                </div>
                {(Array.isArray((postMeta as any).tags) && (postMeta as any).tags.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {(postMeta as any).tags.map((tag: string) => (
                      <Link key={tag} to={`/blog/tag/${encodeURIComponent(tag)}`} className="text-xs px-2 py-1 bg-muted rounded hover:bg-accent">
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <h1 className="text-4xl font-bold text-foreground mb-6">
                {postMeta.title}
              </h1>

              <p className="text-xl text-muted-foreground mb-8">
                {postMeta.excerpt}
              </p>

              {/* Author Byline */}
              <div className="flex items-start gap-4 py-6 border-y border-border bg-muted/30 rounded-lg px-6">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary border border-primary/20">
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                    <h3 className="font-semibold text-foreground text-base">{postMeta.author}</h3>
                    <span className="hidden sm:inline text-sm text-muted-foreground">•</span>
                    <Link to="/about" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                      View Profile
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {AUTHOR_INFO.bio}
                  </p>
                </div>
              </div>
            </header>

            {/* Article Content and Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
              {/* Main Content */}
              <article className="lg:col-span-3">
                <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                  <ArticleContentWithCTAs content={content} slug={postMeta.slug} />
                </div>
              </article>

              {/* Sidebar */}
              <aside className="lg:col-span-1">
                <div className="sticky top-24 space-y-8">
                  <TableOfContents content={content} />

                  {/* Share Card */}
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4">Share This Article</h3>
                      <ShareButtons 
                        url={`${window.location.origin}/blog/${postMeta.slug}`}
                        title={postMeta.title}
                        description={postMeta.excerpt}
                      />
                    </CardContent>
                  </Card>
                </div>
              </aside>
            </div>
          </article>

          {/* Enhanced CTA Section */}
          <CTASection />

          {/* Related Articles */}
          <div className="mt-12">
            <h3 className="text-2xl font-semibold mb-6 text-foreground">Related Articles</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {relatedPosts.map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="block group">
                  <div className="border rounded-lg p-6 hover:border-primary/50 transition-colors">
                    <Badge variant="outline" className="mb-3">{p.category}</Badge>
                    <h4 className="font-semibold group-hover:text-primary transition-colors mb-2">{p.title}</h4>
                    <p className="text-sm text-muted-foreground">{p.excerpt}</p>
                  </div>
                </Link>
              ))}
              {relatedPosts.length === 0 && (
                <p className="text-sm text-muted-foreground">No related articles yet.</p>
              )}
            </div>
          </div>

          {/* Prev / Next Navigation */}
          {(prevPost || nextPost) && (
            <div className="mt-12 grid md:grid-cols-2 gap-6">
              {prevPost && (
                <Link to={`/blog/${prevPost.slug}`} className="block group">
                  <div className="border rounded-lg p-6 hover:border-primary/50 transition-colors">
                    <p className="text-xs text-muted-foreground mb-2">Previous</p>
                    <h4 className="font-semibold group-hover:text-primary transition-colors mb-1">{prevPost.title}</h4>
                    <p className="text-sm text-muted-foreground">{prevPost.excerpt}</p>
                  </div>
                </Link>
              )}
              {nextPost && (
                <Link to={`/blog/${nextPost.slug}`} className="block group md:text-right">
                  <div className="border rounded-lg p-6 hover:border-primary/50 transition-colors">
                    <p className="text-xs text-muted-foreground mb-2">Next</p>
                    <h4 className="font-semibold group-hover:text-primary transition-colors mb-1">{nextPost.title}</h4>
                    <p className="text-sm text-muted-foreground">{nextPost.excerpt}</p>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Component to inject CTAs strategically within article content
const ArticleContentWithCTAs = ({ content, slug }: { content: string, slug: string }) => {
  const sections = content.split(/\n## /); // Split by main headings

  // Function to process content and replace shortcodes
  const processContent = (text: string) => {
    const audioStoryRegex = /<audio-story\s+audioUrl="([^"]+)"\s+title="([^"]+)"\s+description="([^"]+)"\s*\/>/g;
    const hubListRegex = /<hub-list\s+([^\/>]*)\/>/g; // attributes key="value"
    const seeAlsoRegex = /<see-also\s*([^\/>]*)\/>/g;
    
    const elements: React.ReactNode[] = [];
    let cursor = 0;

    const findNext = () => {
      const a = audioStoryRegex.exec(text);
      const h = hubListRegex.exec(text);
      const s = seeAlsoRegex.exec(text);
      const matches: any[] = [];
      if (a) matches.push({ type: 'audio', m: a });
      if (h) matches.push({ type: 'hub', m: h });
      if (s) matches.push({ type: 'see', m: s });
      if (matches.length === 0) return null;
      // earliest
      matches.sort((x, y) => x.m.index - y.m.index);
      return matches[0];
    };

    const slugify = (raw: string) =>
      raw
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    const getText = (children: any): string => {
      return React.Children.toArray(children)
        .map((child: any) => {
          if (typeof child === 'string') return child;
          if (typeof child === 'number') return String(child);
          if (child?.props?.children) return getText(child.props.children);
          return '';
        })
        .join('');
    };
    
    while (true) {
      const next = findNext();
      const nextIndex = next ? next.m.index : -1;
      const chunk = nextIndex === -1 ? text.slice(cursor) : text.slice(cursor, nextIndex);
      if (chunk) {
        elements.push(
          <ReactMarkdown
            key={`md-${cursor}`}
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeHighlight]}
            components={{
              h1: ({ children, ...props }) => {
                const id = slugify(getText(children));
                return <h1 id={id} {...props}>{children}</h1>;
              },
              h2: ({ children, ...props }) => {
                const id = slugify(getText(children));
                return <h2 id={id} {...props}>{children}</h2>;
              },
              h3: ({ children, ...props }) => {
                const id = slugify(getText(children));
                return <h3 id={id} {...props}>{children}</h3>;
              },
            }}
          >{chunk}</ReactMarkdown>
        );
      }

      if (!next) break;
      const { type, m } = next;
      // advance cursor past this match
      cursor = m.index + m[0].length;
      if (type === 'audio') {
        const [, audioUrl, title, description] = m;
        elements.push(
          <div key={`audio-${m.index}`} className="not-prose my-8">
            <AudioStory audioUrl={audioUrl} title={title} description={description} />
          </div>
        );
      } else if (type === 'hub') {
        const attr = m[1] || '';
        const attrs: Record<string,string> = {};
        attr.replace(/(\w+)="([^"]*)"/g, (_: any, k: string, v: string) => { attrs[k] = v; return ''; });
        const tags = attrs['tags'] ? attrs['tags'].split(',').map(s => s.trim()).filter(Boolean) : undefined;
        const category = attrs['category'];
        const limit = attrs['limit'] ? parseInt(attrs['limit'], 10) : undefined;
        elements.push(
          <HubList key={`hub-${m.index}`} tags={tags} category={category} limit={limit} excludeSlug={slug} title={attrs['title']} />
        );
      } else if (type === 'see') {
        const attr = m[1] || '';
        const attrs: Record<string,string> = {};
        attr.replace(/(\w+)="([^"]*)"/g, (_: any, k: string, v: string) => { attrs[k] = v; return ''; });
        const limit = attrs['limit'] ? parseInt(attrs['limit'], 10) : 3;
        elements.push(<SeeAlso key={`see-${m.index}`} slug={slug} limit={limit} />);
      }
      // reset lastIndex for other regex to continue scanning next matches
      audioStoryRegex.lastIndex = cursor;
      hubListRegex.lastIndex = cursor;
      seeAlsoRegex.lastIndex = cursor;
    }
    
    return elements;
  };

  return (
    <>
      {processContent(sections[0])}

      {sections.slice(1).map((section, index) => {
        const shouldShowCTA = index === Math.floor((sections.length - 1) * 0.3) ||
                             index === Math.floor((sections.length - 1) * 0.7);

        return (
          <div key={index}>
            {processContent('## ' + section)}
            {/* Mid-article See Also after first section */}
            {index === 0 && <SeeAlso slug={slug} limit={3} />}

            {shouldShowCTA && (
              <div className="not-prose">
                <CTASection
                  variant="compact"
                  title="Been Scammed by Solar Companies?"
                  description="Our attorneys specialize in solar fraud cases and can help you recover your losses. Get personalized legal advice for your situation."
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default BlogPost;
