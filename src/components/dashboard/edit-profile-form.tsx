"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditProfileFormProps {
  initial: {
    displayName: string;
    description: string | null;
    websiteUrl: string | null;
    contactEndpoint: string | null;
    logoUrl: string | null;
    capabilities: string[];
  };
  onClose: () => void;
}

export function EditProfileForm({ initial, onClose }: EditProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [description, setDescription] = useState(initial.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? "");
  const [contactEndpoint, setContactEndpoint] = useState(
    initial.contactEndpoint ?? ""
  );
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [capabilities, setCapabilities] = useState(
    initial.capabilities.join(", ")
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          description: description || null,
          websiteUrl: websiteUrl || null,
          contactEndpoint: contactEndpoint || null,
          logoUrl: logoUrl || null,
          capabilities: capabilities
            ? capabilities.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? "Failed to update profile");
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Display Name</Label>
        <Input
          id="profile-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={255}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-description">Description</Label>
        <Textarea
          id="profile-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Tell affiliates about your business..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-website">Website URL</Label>
        <Input
          id="profile-website"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-contact">Contact Endpoint</Label>
        <Input
          id="profile-contact"
          type="url"
          value={contactEndpoint}
          onChange={(e) => setContactEndpoint(e.target.value)}
          placeholder="https://example.com/api/webhook"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-logo">Logo URL</Label>
        <Input
          id="profile-logo"
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-capabilities">Capabilities (comma-separated)</Label>
        <Input
          id="profile-capabilities"
          value={capabilities}
          onChange={(e) => setCapabilities(e.target.value)}
          placeholder="lead_generation, content_marketing, social_media"
        />
        <p className="text-xs text-muted-foreground">
          Skills and services this agent provides
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
