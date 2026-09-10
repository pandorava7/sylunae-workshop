import type { MouseEvent, RefObject } from 'react'
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from './ui/pagination'

interface ContentPaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** The page-specific content area to align with the top of its scroll container. */
  scrollTargetRef?: RefObject<HTMLElement | null>
}

export function ContentPagination({ page, pageCount, onPageChange, scrollTargetRef }: ContentPaginationProps) {
  if (pageCount <= 1) return null
  const pages = paginationItems(page, pageCount)
  const selectPage = (event: MouseEvent, nextPage: number) => {
    event.preventDefault()
    if (nextPage === page) return
    scrollToContentTop(scrollTargetRef?.current)
    onPageChange(nextPage)
  }

  return <Pagination className="content-pagination">
    <PaginationContent>
      <PaginationItem><PaginationPrevious href="#" text="上一页" aria-disabled={page === 1} className={page === 1 ? 'disabled' : ''} onClick={(event) => { if (page > 1) selectPage(event, page - 1); else event.preventDefault() }} /></PaginationItem>
      {pages.map((item) => typeof item === 'number' ? <PaginationItem key={item}><PaginationLink href="#" isActive={item === page} onClick={(event) => selectPage(event, item)}>{item}</PaginationLink></PaginationItem> : <PaginationItem key={item}><PaginationEllipsis /></PaginationItem>)}
      <PaginationItem><PaginationNext href="#" text="下一页" aria-disabled={page === pageCount} className={page === pageCount ? 'disabled' : ''} onClick={(event) => { if (page < pageCount) selectPage(event, page + 1); else event.preventDefault() }} /></PaginationItem>
    </PaginationContent>
  </Pagination>
}

function scrollToContentTop(target: HTMLElement | null | undefined) {
  if (!target) return
  const container = findScrollContainer(target)
  if (!container) return

  const targetTop = target.getBoundingClientRect().top
  const containerTop = container.getBoundingClientRect().top
  if (targetTop >= containerTop) return

  container.scrollTo({
    top: Math.max(0, container.scrollTop + targetTop - containerTop),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}

function findScrollContainer(target: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = target
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) return current
    current = current.parentElement
  }
  return null
}

function paginationItems(current: number, total: number): Array<number | string> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'end', total]
  if (current >= total - 3) return [1, 'start', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'start', current - 1, current, current + 1, 'end', total]
}
