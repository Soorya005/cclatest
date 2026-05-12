import React, { useState, useEffect } from 'react';

interface Post {
  id: number;
  title: string;
  content: string;
  author_id: number;
  tags?: string;
}

export const Feed: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const response = await fetch('/api/posts/');
                const data = await response.json();
                setPosts(data);
            } catch (error) {
                console.error("Failed to load feed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPosts();
    }, []);

    if (loading) return <div>Loading dev feed...</div>;

    return (
        <div className="space-y-4">
            {posts.map(post => (
                <div key={post.id} className="p-4 border rounded shadow-sm bg-neutral-900 border-neutral-800">
                    <h2 className="text-lg font-bold text-blue-400">{post.title}</h2>
                    <p className="mt-2 text-neutral-300">{post.content}</p>
                    <div className="mt-3 flex gap-2">
                        {post.tags?.split(',').map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                                #{tag.trim()}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
