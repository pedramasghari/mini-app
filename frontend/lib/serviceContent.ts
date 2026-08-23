export type ServiceContent = {
  slug: string;
  title: string;
  shortDescription: string;
  heroImage?: string;
  tutorial?: { type: 'image' | 'video'; src: string; title?: string };
  serverText: string;
  rules: string[];
  faqs: { question: string; answer: string }[];
};

// محتوای نمایشی فعلاً خارج از دیتابیس است و بعداً می‌توان آن را برای هر سرویس تکمیل کرد.
export const serviceContent: Record<string, ServiceContent> = {
  'apple-id': {
    slug: 'apple-id',
    title: 'اپل آیدی',
    shortDescription: 'سرویس ساخت و فعال‌سازی اپل آیدی با راهنمای مرحله‌به‌مرحله.',
    serverText: 'اطلاعات و توضیحات اختصاصی این سرویس بعداً توسط شما تکمیل می‌شود.',
    rules: ['قوانین استفاده از سرویس در این بخش قرار می‌گیرد.', 'اطلاعات سفارش را با دقت وارد کنید.', 'پس از ثبت سفارش، مراحل انجام کار را از داخل پنل دنبال کنید.'],
    faqs: [
      { question: 'مدت زمان انجام سفارش چقدر است؟', answer: 'این پاسخ بعداً توسط شما تکمیل می‌شود.' },
      { question: 'در صورت بروز مشکل چه کار کنم؟', answer: 'از بخش پشتیبانی با ما در ارتباط باشید.' },
    ],
  },
};

export function getServiceContent(slug: string) {
  return serviceContent[slug] ?? {
    slug,
    title: 'سرویس',
    shortDescription: 'اطلاعات این سرویس به‌زودی تکمیل می‌شود.',
    serverText: '',
    rules: [],
    faqs: [],
  } satisfies ServiceContent;
}
