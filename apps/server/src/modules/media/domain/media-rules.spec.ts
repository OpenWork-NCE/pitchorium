import { MEDIA_USAGES } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import {
  assertAttachable,
  assertDeclaredUpload,
  assertWithinQuota,
  checkContent,
  checkImageDimensions,
  checkPdfPages,
  type MediaAssetRecord,
} from './media-asset';
import { isImageType, USAGE_RULES } from './usages';

const codeOf = (work: () => unknown) => {
  try {
    work();
  } catch (error) {
    return error instanceof DomainError ? error.code : 'unexpected';
  }
  return 'none';
};

const asset = (overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord => ({
  id: 'media-1',
  ownerId: 'user-1',
  usage: 'avatar',
  source: 'upload',
  status: 'ready',
  visibility: 'public',
  declaredContentType: 'image/png',
  declaredSize: 1000,
  contentType: 'image/png',
  size: 1000,
  sha256: 'abc',
  width: 400,
  height: 400,
  pageCount: null,
  quarantineKey: 'quarantine/media-1',
  files: null,
  rejectionReason: null,
  moderationStatus: 'none',
  importUrl: null,
  attachedTo: null,
  unattachedSince: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('usage limits', () => {
  it('defines consistent rules for every usage', () => {
    for (const usage of MEDIA_USAGES) {
      const rule = USAGE_RULES[usage];
      const acceptsImages = rule.contentTypes.some(isImageType);
      expect(rule.image !== null, usage).toBe(acceptsImages);
      expect(rule.pdf !== null, usage).toBe(rule.contentTypes.includes('application/pdf'));
      if (rule.image) expect(rule.image.variants.length, usage).toBeGreaterThan(0);
    }
    expect(USAGE_RULES.verification_document.visibility).toBe('private');
  });

  it('checks the declared type and size before issuing an upload URL', () => {
    expect(codeOf(() => assertDeclaredUpload('avatar', 'application/pdf', 100))).toBe(
      'MEDIA_TYPE_NOT_ALLOWED',
    );
    expect(codeOf(() => assertDeclaredUpload('avatar', 'image/png', 5 * 1024 * 1024 + 1))).toBe(
      'MEDIA_TOO_LARGE',
    );
    expect(codeOf(() => assertDeclaredUpload('post_document', 'application/pdf', 1000))).toBe(
      'none',
    );
  });

  it('enforces the quota in files and bytes', () => {
    const quota = { maxFiles: 2, maxBytes: 1000 };
    expect(codeOf(() => assertWithinQuota({ count: 1, bytes: 500 }, 500, quota))).toBe('none');
    expect(codeOf(() => assertWithinQuota({ count: 2, bytes: 0 }, 1, quota))).toBe(
      'MEDIA_QUOTA_EXCEEDED',
    );
    expect(codeOf(() => assertWithinQuota({ count: 0, bytes: 900 }, 101, quota))).toBe(
      'MEDIA_QUOTA_EXCEEDED',
    );
  });
});

describe('content checks', () => {
  const avatar = USAGE_RULES.avatar;

  it('never trusts the declared type nor the declared size', () => {
    const png = (size = 100) => ({ contentType: 'image/png' as const, size });
    expect(checkContent(avatar, png(), 'image/png', 100)).toBeNull();
    expect(checkContent(avatar, png(), 'image/jpeg', 100)).toBe('type_mismatch');
    expect(checkContent(avatar, png(), 'application/pdf', 100)).toBe('type_not_allowed');
    expect(checkContent(avatar, png(), null, 100)).toBe('type_not_allowed');
    expect(checkContent(avatar, png(avatar.maxBytes + 1), 'image/png', avatar.maxBytes + 1)).toBe(
      'size_exceeded',
    );
    // A file larger or smaller than declared, should the storage not enforce the signed size.
    expect(checkContent(avatar, png(100), 'image/png', 101)).toBe('size_mismatch');
    expect(checkContent(avatar, png(100), 'image/png', 99)).toBe('size_mismatch');
    // An imported photo has no declared type: only the detected one counts.
    expect(checkContent(avatar, null, 'image/jpeg', 100)).toBeNull();
  });

  it('checks image dimensions and PDF pages', () => {
    expect(checkImageDimensions(avatar, 199, 400)).toBe('image_too_small');
    expect(checkImageDimensions(avatar, 8001, 400)).toBe('image_too_large');
    expect(checkImageDimensions(avatar, 400, 400)).toBeNull();
    expect(checkPdfPages(USAGE_RULES.post_document, 51)).toBe('pdf_too_many_pages');
    expect(checkPdfPages(USAGE_RULES.post_document, 50)).toBeNull();
    expect(checkPdfPages(avatar, 1)).toBe('type_not_allowed');
  });
});

describe('attachment', () => {
  it('attaches only a ready file of the owner, for the same usage', () => {
    expect(codeOf(() => assertAttachable(asset(), 'user-1', 'avatar'))).toBe('none');
    expect(codeOf(() => assertAttachable(asset(), 'user-2', 'avatar'))).toBe('MEDIA_NOT_FOUND');
    expect(codeOf(() => assertAttachable(null, 'user-1', 'avatar'))).toBe('MEDIA_NOT_FOUND');
    expect(codeOf(() => assertAttachable(asset(), 'user-1', 'profile_cover'))).toBe(
      'MEDIA_USAGE_MISMATCH',
    );
    expect(
      codeOf(() => assertAttachable(asset({ status: 'processing' }), 'user-1', 'avatar')),
    ).toBe('MEDIA_NOT_READY');
  });
});
