import { Octokit } from "@octokit/rest";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json({ error: "Owner and repo parameters are required" }, { status: 400 });
  }

  try {
    const octokit = new Octokit({ auth: session.accessToken });
    
    // Get repository branches
    const response = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 100, // Get up to 100 branches
    });
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
} 