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
          <TableHead className="px-4 py-3 w-12">
            <Checkbox
              aria-label="Select page"
              checked={allSelectedOnPage ? true : someSelectedOnPage ? 'indeterminate' : false}
              onCheckedChange={() => onSelectPage(!allSelectedOnPage)}
            />
          </TableHead>
          <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 w-[50px]">
            Profile
          </TableHead>
          <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 w-[15%] min-w-[120px]">
            {normalizePlatform(platformHint) === 'youtube' ? 'Channel Name' : 'Username'}
          </TableHead>
          <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 w-[15%] min-w-[100px]">
            Full Name
          </TableHead>
          <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 w-[25%] min-w-[200px]">
            Bio
          </TableHead>
          <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 w-[20%] min-w-[150px]">
            Email
          </TableHead>
          {shouldShowAccountColumns && (
            <>
              <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 w-[7%] min-w-[60px]">
                Private
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 w-[7%] min-w-[60px]">
                Verified
              </TableHead>
            </>
          )}
          <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 text-right">
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
              className={cn('table-row transition-colors', isSelected && 'bg-emerald-500/5')}
            >
              <TableCell className="px-4 py-4 w-12 align-middle">
                <div className="flex h-full items-center justify-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection(row.id, row.snapshot)}
                    aria-label={`Select ${row.username}`}
                  />
                </div>
              </TableCell>
              <TableCell className="px-6 py-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={row.avatarUrl} alt={row.username} />
                  <AvatarFallback>{row.initials}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="px-6 py-4">
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
              </TableCell>
              <TableCell className="px-6 py-4">
                <span className="text-sm text-zinc-300">{row.displayName || 'N/A'}</span>
              </TableCell>
              <TableCell className="px-6 py-4 max-w-0">
                <div className="truncate" title={row.bio || 'No bio available'}>
                  {row.bio ? (
                    <span className="text-sm text-zinc-300">{row.bio}</span>
                  ) : (
                    <span className="text-sm text-zinc-500">Not available</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 max-w-0">
                {renderEmails(row.emails)}
              </TableCell>
              {shouldShowAccountColumns && (
                <>
                  <TableCell className="px-6 py-4">{row.isPrivate ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="px-6 py-4">{row.isVerified ? 'Yes' : 'No'}</TableCell>
                </>
              )}
              <TableCell className="px-6 py-4 text-right">
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
