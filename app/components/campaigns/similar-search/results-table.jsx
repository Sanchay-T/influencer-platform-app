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

const normalizePlatform = (value) => {
  if (!value) return '';
  return value.toString().toLowerCase();
};

export default function SimilarResultsTable({
  rows,
  platformHint,
  selectedCreators,
  onToggleSelection,
  onSelectPage,
  allSelectedOnPage,
  someSelectedOnPage,
}) {
  const shouldShowAccountColumns = normalizePlatform(platformHint) !== 'youtube';

  return (
    <Table className="w-full">
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
          <TableHead className="hidden sm:table-cell px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
            {normalizePlatform(platformHint) === 'youtube' ? 'Channel Name' : 'Username'}
          </TableHead>
          <TableHead className="hidden lg:table-cell px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
            Full Name
          </TableHead>
          <TableHead className="hidden xl:table-cell px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
            Bio
          </TableHead>
          <TableHead className="hidden lg:table-cell px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
            Email
          </TableHead>
          {shouldShowAccountColumns && (
            <>
              <TableHead className="hidden xl:table-cell px-3 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Private
              </TableHead>
              <TableHead className="hidden xl:table-cell px-3 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Verified
              </TableHead>
            </>
          )}
          <TableHead className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 text-right">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isSelected = Boolean(selectedCreators[row.id]);
          const profileLabel = normalizePlatform(row.platform) === 'youtube' ? row.displayName : `@${row.username}`;

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
                    <div className="text-xs text-zinc-400">{profileLabel}</div>
                    <div className="space-y-1 text-xs text-zinc-400 sm:hidden">
                      {row.bio && (
                        <div className="line-clamp-3" title={row.bio}>
                          {row.bio}
                        </div>
                      )}
                      {row.emails?.length ? (
                        <div className="break-words">
                          <span className="font-medium text-zinc-300">Email:</span>{' '}
                          {row.emails[0]}
                        </div>
                      ) : null}
                      {shouldShowAccountColumns && (
                        <div>
                          <span className="font-medium text-zinc-300">Private:</span>{' '}
                          {row.isPrivate ? 'Yes' : 'No'}
                          {' • '}
                          <span className="font-medium text-zinc-300">Verified:</span>{' '}
                          {row.isVerified ? 'Yes' : 'No'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell px-3 py-4">
                <a
                  href={row.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium text-pink-400 transition-colors hover:text-pink-300 hover:underline"
                  title={`View ${row.username} on ${row.platform}`}
                >
                  {profileLabel}
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
              <TableCell className="hidden lg:table-cell px-3 py-4 text-sm text-zinc-300">
                {row.displayName || 'N/A'}
              </TableCell>
              <TableCell className="hidden xl:table-cell px-3 py-4 max-w-0">
                <div className="truncate" title={row.bio || 'No bio available'}>
                  {row.bio ? (
                    <span className="text-sm text-zinc-300">{row.bio}</span>
                  ) : (
                    <span className="text-sm text-zinc-500">Not available</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell px-3 py-4 max-w-0">
                {renderEmails(row.emails)}
              </TableCell>
              {shouldShowAccountColumns && (
                <>
                  <TableCell className="hidden xl:table-cell px-3 py-4">{row.isPrivate ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="hidden xl:table-cell px-3 py-4">{row.isVerified ? 'Yes' : 'No'}</TableCell>
                </>
              )}
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
