'use client';

import type { Message, PostImage } from '@pitchorium/contracts';
import { ImageGallery, PostDocument } from '@/features/content';

/** The images of a message in the viewer of the publications, the PDFs as a document. */
export default function MessageAttachments({ message }: { message: Message }) {
  const images: PostImage[] = message.attachments.flatMap((attachment) =>
    attachment.image
      ? [
          {
            mediaId: attachment.mediaId,
            url: attachment.image.url,
            variants: attachment.image.variants,
            alt: attachment.text,
          },
        ]
      : [],
  );
  const documents = message.attachments.filter((attachment) => !attachment.image);
  if (images.length === 0 && documents.length === 0) return null;
  return (
    <div className="grid w-full max-w-sm gap-2">
      {images.length > 0 ? <ImageGallery images={images} postId={message.id} /> : null}
      {documents.map((attachment) => (
        <PostDocument
          key={attachment.mediaId}
          signedIn
          document={{
            mediaId: attachment.mediaId,
            thumbnailUrl: null,
            pageCount: null,
            title: attachment.text,
          }}
        />
      ))}
    </div>
  );
}
