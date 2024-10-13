"use client";

import { getCommunity } from "@/lib/user";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CommunityPage() {
  const { user } = usePrivy();
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (communityId) {
        const communityData = await getCommunity(communityId);
        setCommunity(communityData);
      }
      setLoading(false);
    }
    fetchData();
  }, [communityId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{community?.name}</h1>
      <p className="mb-4">{community?.description}</p>
      <p className="mb-4">Type: {community?.type}</p>
      <p className="mb-4">Members: {community?.member_ids?.length}</p>
      <p className="mb-4">Fund Balance: ${community?.fund_balance}</p>

      <Link
        href={`/community/${communityId}/proposals`}
        className="btn btn-primary"
      >
        View Proposals
      </Link>
    </div>
  );
}
