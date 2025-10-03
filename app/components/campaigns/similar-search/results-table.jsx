'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { AddToListButton } from '@/components/lists/add-to-list-button';
import { cn } from '@/lib/utils';
import { ExternalLink, Mail } from 'lucide-react';

function renderEmails(emails = []) {
  if (!Array.isArray(emails) || emails.length === 0) {
    return <span className="text-zinc-500 text-sm">Not available</span>;
  }

  return (
    <div className="space-y-1">
      {emails.map((email) => (
        <div key={email} className="flex items-center gap-1">
          <a
            href={`mailto:${email}`}
            className="text-pink-400 hover:underline text-sm truncate block"
            title={`Send email to ${email}`}
          >
            {email}
          </a>
          <Mail className="h-3 w-3 text-pink-400 opacity-70" />
        </div>
      ))}
    </div>
  );
}

export default function SimilarResultsTable({
  rows,
  selectedCreators,
  onToggleSelection,
  onSelectPage,
  allSelectedOnPage,
  someSelectedOnPage,
}) {
  return (
    <Table className="w-full table-auto">
      <TableHeader>
        <TableRow className="border-b border-zinc-800">
          <TableHead className="w-12 px-3 py-3">
            <Checkbox
              aria-label="Select page"
              checked={allSelectedOnPage ? true : someSelectedOnPage ? 'indeterminate' : false}
              onCheckedChange={() => onSelectPage(!allSelectedOnPage)}
            />
          </TableHead>
          <TableHead className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
            Profile
          </TableHead>
          <TableHead className="hidden sm:table-cell px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 sm:w-44">
            Username
          </TableHead>
          <TableHead className="hidden md:table-cell px-3 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 text-right">
            Followers
          </TableHead>
          <TableHead className="hidden xl:table-cell px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 xl:w-[220px]">
            Bio
          </TableHead>
          <TableHead className="hidden lg:table-cell px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 lg:w-[200px]">
            Email
          </TableHead>
          <TableHead className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 text-right">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isSelected = Boolean(selectedCreators[row.id]);
          const usernameLabel = row.username
            ? (row.username.startsWith('@') ? row.username : `@${row.username}`)
            : '—';

          return (
            <TableRow
              key={row.id}
              className={cn('table-row transition-colors align-top', isSelected && 'bg-emerald-500/5')}
            >
              <TableCell className="w-12 px-3 py-4 align-middle">
                <div className="flex h-full items-center justify-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection(row.id, row.snapshot)}
                    aria-label={`Select ${row.username}`}
                  />
                </div>
              </TableCell>
              <TableCell className="px-3 py-4 align-top">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={row.avatarUrl} alt={row.username} />
                    <AvatarFallback>{row.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium text-zinc-100 leading-tight">
                      {row.displayName || row.username}
                    </div>
                    <div className="text-xs text-zinc-400">{usernameLabel}</div>
                    <div className="space-y-1 text-xs text-zinc-400 sm:hidden">
                      {row.bio && (
                        <div className="line-clamp-3" title={row.bio}>
                          {row.bio}
                        </div>
                      )}
                      {row.followerLabel ? (
                        <div className="break-words">
                          <span className="font-medium text-zinc-300">Followers:</span>{' '}
                          {row.followerLabel}
                        </div>
                      ) : null}
                      {row.emails?.length ? (
                        <div className="break-words">
                          <span className="font-medium text-zinc-300">Email:</span>{' '}
                          {row.emails[0]}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell px-3 py-4 align-top sm:w-44 sm:max-w-xs">
                <a
                  href={row.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-1 font-medium text-pink-400 transition-colors hover:text-pink-300 hover:underline"
                  title={`View ${row.username || row.displayName} on ${row.platform}`}
                >
                  <span className="truncate">{usernameLabel}</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
                <div className="mt-2 space-y-1 text-xs text-zinc-400 lg:hidden">
                  {row.emails?.length ? (
                    <div className="break-words">
                      <span className="font-medium text-zinc-300">Email:</span>{' '}
                      {row.emails[0]}
                    </div>
                  ) : null}
                  {row.bio && (
                    <div className="line-clamp-2" title={row.bio}>
                      {row.bio}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell px-3 py-4 text-right text-sm text-zinc-300">
                {row.followerLabel ?? '—'}
              </TableCell>
              <TableCell className="hidden xl:table-cell px-3 py-4 xl:w-[220px]">
                <div className="line-clamp-3" title={row.bio || 'No bio available'}>
                  {row.bio ? (
                    <span className="text-sm text-zinc-300">{row.bio}</span>
                  ) : (
                    <span className="text-sm text-zinc-500">Not available</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell px-3 py-4 lg:w-[200px]">
                <div className="space-y-1 text-sm text-zinc-300">
                  {renderEmails(row.emails)}
                </div>
              </TableCell>
              <TableCell className="px-3 py-4 text-right">
                <AddToListButton
                  creators={[row.snapshot]}
                  buttonLabel=""
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-emerald-300"
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
