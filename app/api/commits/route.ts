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
  const branch = url.searchParams.get("branch") || "main";

  if (!owner || !repo) {
    return NextResponse.json({ error: "Owner and repo parameters are required" }, { status: 400 });
  }

  try {
    const octokit = new Octokit({ auth: session.accessToken });
    
    // Get commits with files changed
    const commits = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 20,
      sha: branch,
    });
    
    // For each commit, get the detailed information including files changed
    const commitsWithFiles = await Promise.all(
      commits.data.map(async (commit) => {
        const detail = await octokit.repos.getCommit({
          owner,
          repo,
          ref: commit.sha,
        });
        
        // Check if this is a merge commit (has more than one parent)
        const isMergeCommit = commit.parents && commit.parents.length > 1;
        
        // Store additional merge information if this is a merge commit
        let mergeDetails = null;
        if (isMergeCommit && commit.parents.length >= 2) {
          try {
            // Get the comparison between the two parent commits to understand what was merged
            const comparison = await octokit.repos.compareCommits({
              owner,
              repo,
              base: commit.parents[0].sha,
              head: commit.parents[1].sha,
            });
            
            mergeDetails = {
              baseSha: commit.parents[0].sha,
              headSha: commit.parents[1].sha,
              totalCommits: comparison.data.total_commits,
              changedFiles: comparison.data.files?.map(file => ({
                filename: file.filename,
                status: file.status,
                additions: file.additions,
                deletions: file.deletions,
                patch: file.patch,
              })) || [],
            };
          } catch (error) {
            console.error("Error getting merge details:", error);
          }
        }
        
        // Extract file patches for better code analysis
        const fileDetails = detail.data.files?.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch || "",
        })) || [];
        
        return {
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.author?.login || commit.commit?.author?.name || "Unknown",
          date: commit.commit?.author?.date || new Date().toISOString(),
          isMergeCommit,
          mergeDetails,
          fileDetails,
          files: detail.data.files?.map(file => file.filename) || [],
        };
      })
    );
    
    return NextResponse.json(commitsWithFiles);
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json({ error: "Failed to fetch commits" }, { status: 500 });
  }
} 