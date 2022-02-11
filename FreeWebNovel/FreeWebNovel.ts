import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    LanguageCode,
    Manga,
    MangaStatus,
    MangaTile,
    PagedResults,
    Request,
    SearchRequest,
    Source,
    SourceInfo,
    Tag,
    RequestManager
} from 'paperback-extensions-common'

import { interceptResponse, spliterate } from "./FreeWebNovelResponseInterceptor";

const WEBSITE_URL = "https://freewebnovel.com"
const REQUEST_RETRIES = 3
const MAX_PAGE_WIDTH = 800
const LINES_PER_PAGE = 60.0
const COOKIES = [
    createCookie({
        name: '__cf_bm',
        value: 'JcAPjpD1tisY0N7k4anIphgk1FTVnvd1l5yM1vI7QYM-1644554941-0-AVWF+kRou4qztN8aUJ0ncyVk6Y6JQem9xP3mYminTeyu6oWdVcbk+ylr+T4UcF9WuXb5EF2fspjRt/APo5jOIELUy+7pN4UzKPeCxKjDVUKGF1943OSYZpx3VIVrbJJfcQ==',
        domain: '.freewebnovel.com'
    })
]

export class FreeWebNovel extends Source {
    requestManager: RequestManager = createRequestManager({
        requestsPerSecond: 1,
        requestTimeout: 5000,
        interceptor: {
            interceptRequest: async (request) => {return request},
            interceptResponse: async (response) => {return interceptResponse(response, this.cheerio)}
        }
    })
    async getMangaDetails(mangaId: string): Promise<Manga> { 
        const request = createRequestObject({
            url: `${WEBSITE_URL}/${mangaId}.html`,
            method: 'GET',
            //cookies: COOKIES
        })
        const response = await this.requestManager.schedule(request, REQUEST_RETRIES)
        const $ = this.cheerio.load(response.data)
        const htmlInfo = $('div.m-book1')
        const titles: string[] = [$('h1.tit', htmlInfo).text()]
        const tagStrings: string[] = []
        let status = MangaStatus.UNKNOWN
        let author = undefined
        for(let object of $('div.txt > div', htmlInfo).toArray()) {
            switch($('span.glyphicon', object).attr('title')) {
                case 'Alternative names': titles.push(...($('span.s1', object).text().split(', '))); break
                case 'Author': author = $('span.s1', object).text(); break
                case 'Genre': tagStrings.push(...($('span.s1', object).text().split(', '))); break
                case 'Status': status = $('span.s1', object).text().toLowerCase() === 'completed' ? MangaStatus.COMPLETED : MangaStatus.ONGOING
            }
        }
        const tags: Tag[] = []
        for(let tag of tagStrings) {
            tags.push(createTag({ id: tag, label: tag }))
        }
        return createManga({
            id: mangaId,
            titles: titles,
            image: $('div.pic > img', htmlInfo).attr('src'),
            status: status,
            author: author,
            tags: [createTagSection({ id: 'genres', label: 'Genres', tags: tags })]
        })
    }
    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${WEBSITE_URL}/${mangaId}.html`,
            method: 'GET',
            //cookies: COOKIES
        })
        const response = await this.requestManager.schedule(request, REQUEST_RETRIES)
        let $ = this.cheerio.load(response.data)
        const chapterPages = $('div.page > select > option').toArray()
        const chapters: Chapter[] = []
        while(chapterPages.length > 0) {
            const option = chapterPages.shift()
            const newRequest = createRequestObject({
                url: `${WEBSITE_URL}${$(option).attr('value')}`,
                method: 'GET',
            })
            const newResponse = await this.requestManager.schedule(newRequest, REQUEST_RETRIES)
            $ = this.cheerio.load(newResponse.data)
            const embeddedChapters = $('div.m-newest2 > ul.ul-list5 > li').toArray()
            for(let embeddedChapter of embeddedChapters) {
                const link = $('a', embeddedChapter).attr('href')
                chapters.push(createChapter({
                    id: link.substring(1, link.indexOf('.')),
                    mangaId: mangaId,
                    chapNum: isNaN(parseInt(link.substring(link.lastIndexOf('-')+1, link.indexOf('.')))) ? 0 : parseInt(link.substring(link.lastIndexOf('-')+1, link.indexOf('.'))),
                    langCode: LanguageCode.ENGLISH,
                    name: $(embeddedChapter).text()
                }))
            }
        }
        return chapters
    }
    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${WEBSITE_URL}/${chapterId}.html`,
            method: 'GET',
            //cookies: COOKIES
        })
        const response = await this.requestManager.schedule(request, REQUEST_RETRIES)
        const $ = this.cheerio.load(response.data)
        const pages: string[] = []
        const textSegments: string[] = []
        const chapterText = $('div.txt > p').toArray()
        for(let chapterTextSeg of chapterText) {
            textSegments.push($(chapterTextSeg).text())
        }
        const text = textSegments.join('\n\n')
        const lines = Math.floor(spliterate(text, MAX_PAGE_WIDTH).split.length/LINES_PER_PAGE)
        for(let i = 1; i <= lines; i++) {
            pages.push(`${WEBSITE_URL}/${chapterId}.html?ttiparse&ttipage=${i}`)
        }
        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: true
        })
    }
    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        if(!query.title || query.title.length < 3) return createPagedResults({ results: [] })
        const request = createRequestObject({
            url: `${WEBSITE_URL}/search/?searchkey=${query.title}`,
            method: 'POST',
            //cookies: COOKIES
        })
        const response = await this.requestManager.schedule(request, REQUEST_RETRIES)
        const $ = this.cheerio.load(response.data)
        const htmlResults = $('div.ss-custom > div').toArray()
        const results: MangaTile[] = []
        for(let htmlResult of htmlResults) {
            const a = $('div.pic > a', htmlResult)
            results.push(createMangaTile({
                id: $(a).attr('href').substring(1).split('.')[0],
                title: createIconText({ text: $('img', a).attr('title')}),
                image: $('img', a).attr('src')
            }))
        }
        return createPagedResults({ results: results })
    }
    override getCloudflareBypassRequest(): Request {
        return createRequestObject({
            url: WEBSITE_URL,
            method: 'GET'
        })
    }
}

export const FreeWebNovelInfo: SourceInfo = {
    version: '1.0.0',
    name: 'FreeWebNovel',
    icon: 'icon.jpg',
    author: 'JimIsWayTooEpic',
    authorWebsite: 'https://jimphieffer.com/paperback/',
    description: 'Source for FreeWebNovel. Created by JimIsWayTooEpic.',
    contentRating: ContentRating.ADULT,
    websiteBaseURL: WEBSITE_URL,
    language: "English"
}