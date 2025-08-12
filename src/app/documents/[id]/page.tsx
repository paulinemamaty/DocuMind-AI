import { DocumentWorkspaceRedesigned } from '@/components/document-workspace-redesigned'

export default function DocumentPage({ params }: { params: { id: string } }) {
  return <DocumentWorkspaceRedesigned documentId={params.id} />
}