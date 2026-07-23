import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Award,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Code,
  Database,
  History,
  Monitor,
  Moon,
  RefreshCw,
  Sliders,
  Sun,
  Tent,
  User,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { version } from '../../package.json'
import { useAuth } from '~/lib/auth'
import { clientEnv } from '~/clientEnv'

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
)

const TailwindIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg role="img" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C10.337,13.382,8.976,12,6.001,12z" />
  </svg>
)

const ConvexIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg role="img" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M15.09 18.916c3.488-.387 6.776-2.246 8.586-5.348-.857 7.673-9.247 12.522-16.095 9.545a3.47 3.47 0 0 1-1.547-1.314c-1.539-2.417-2.044-5.492-1.318-8.282 2.077 3.584 6.3 5.78 10.374 5.399m-10.501-7.65c-1.414 3.266-1.475 7.092.258 10.24-6.1-4.59-6.033-14.41-.074-18.953a3.44 3.44 0 0 1 1.893-.707c2.825-.15 5.695.942 7.708 2.977-4.09.04-8.073 2.66-9.785 6.442m11.757-5.437C14.283 2.951 11.053.992 7.515.933c6.84-3.105 15.253 1.929 16.17 9.37a3.6 3.6 0 0 1-.334 2.02c-1.278 2.594-3.647 4.607-6.416 5.352 2.029-3.763 1.778-8.36-.589-11.847" />
  </svg>
)

const TanstackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg role="img" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6.9297 13.6875c.164-.0938.375-.0352.4687.1328l.0625.1055c.4805.8515.9805 1.6601 1.5 2.4258.6133.9023 1.3047 1.8164 2.0743 2.7421a.3455.3455 0 0 1-.0391.4844l-.0742.0664c-2.543 2.2227-4.1914 2.664-4.9532 1.332-.746-1.3046-.4765-3.6718.8086-7.1093a.3437.3437 0 0 1 .1524-.1797ZM17.75 16.3008c.1836-.0313.3594.086.3945.2695l.0196.1016c.6289 3.2851.1875 4.9297-1.3243 4.9297-1.4804 0-3.3593-1.4024-5.6484-4.2032a.3271.3271 0 0 1-.0742-.2226c0-.1875.1562-.3399.3437-.3399h.1211a32.9838 32.9838 0 0 0 2.8086-.0976c1.0703-.086 2.1914-.2305 3.3594-.4375zm.871-6.9766a.3528.3528 0 0 1 .4454-.211l.1016.0352c3.2617 1.1094 4.5039 2.332 3.7187 3.6641-.7656 1.3047-2.9922 2.254-6.6836 2.8477-.082.0117-.168-.004-.2383-.047-.168-.0976-.2265-.3085-.125-.4765l.0625-.1054c.504-.8438.957-1.6836 1.3672-2.5235.4766-.9883.9297-2.0508 1.3516-3.1836zM7.797 8.3398c.082-.0117.168.004.2383.047.168.0976.2265.3085.125.4765l-.0625.1054a34.0882 34.0882 0 0 0-1.3672 2.5235c-.4766.9883-.9297 2.0508-1.3516 3.1836a.3528.3528 0 0 1-.4453.211l-.1016-.0352c-3.2617-1.1094-4.5039-2.332-3.7187-3.6641.7656-1.3047 2.9922-2.254 6.6836-2.8477Zm5.2812-3.9843c2.543-2.2227 4.1914-2.664 4.9532-1.332.746 1.3046.4765 3.6718-.8086 7.1093a.3436.3436 0 0 1-.1524.1797c-.164.0938-.375.0352-.4687-.1328l-.0625-.1055c-.4805-.8515-.9805-1.6601-1.5-2.4258-.6133-.9023-1.3047-1.8164-2.0743-2.7421a.3455.3455 0 0 1 .0391-.4844Zm-5.793-2.082c1.4805 0 3.3633 1.4023 5.6485 4.203a.3488.3488 0 0 1 .0781.2188c-.0039.1914-.1562.3438-.3476.3438l-.1172-.004a34.5835 34.5835 0 0 0-2.8086.1016c-1.0742.086-2.1953.2305-3.3633.4375a.343.343 0 0 1-.3945-.2734l-.0196-.0977c-.629-3.2851-.1876-4.9297 1.3242-4.9297Zm2.8711 5.8124h3.6875a.638.638 0 0 1 .5508.3164l1.8477 3.2188a.6437.6437 0 0 1 0 .6289l-1.8477 3.2227a.638.638 0 0 1-.5507.3164h-3.6875c-.2266 0-.4375-.1211-.547-.3164L7.7579 12.25a.6437.6437 0 0 1 0-.629l1.8516-3.2187c.1093-.1953.3203-.3164.5468-.3164Zm3.2305.793a.638.638 0 0 1 .5508.3164l1.3906 2.4258a.6437.6437 0 0 1 0 .6289l-1.3906 2.4297a.638.638 0 0 1-.5508.3164h-2.7734c-.2266 0-.4375-.1211-.5469-.3164L8.672 12.25a.6437.6437 0 0 1 0-.629l1.3945-2.4257c.1094-.1953.3203-.3164.5469-.3164Zm-.4922.8672h-1.789c-.2266 0-.4336.1172-.547.3164l-.8983 1.5586a.6437.6437 0 0 0 0 .6289l.8984 1.5625a.6317.6317 0 0 0 .5469.3164h1.789a.6317.6317 0 0 0 .547-.3164l.8983-1.5625a.6437.6437 0 0 0 0-.629l-.8984-1.5585c-.1133-.1992-.3203-.3164-.5469-.3164Zm-.4765.8281c.2265 0 .4375.1211.5468.3164l.422.7305c.1132.1953.1132.4375 0 .6289l-.422.7344c-.1093.1953-.3203.3164-.5468.3164h-.836a.6317.6317 0 0 1-.5468-.3164l-.422-.7344c-.1132-.1914-.1132-.4336 0-.629l.422-.7304a.6317.6317 0 0 1 .5468-.3164zm-.418.8164a.548.548 0 0 0-.4727.2735c-.0976.168-.0976.375 0 .5468a.5444.5444 0 0 0 .4727.2696.5444.5444 0 0 0 .4727-.2696c.0976-.1718.0976-.3789 0-.5468A.548.548 0 0 0 12 11.3906Zm-4.4219.5469h.9805M18.9805 7.75c.3906-1.8945.4765-3.3438.2226-4.3984-.1484-.629-.4218-1.1368-.8398-1.5078-.4414-.3907-1-.582-1.625-.582-1.0352 0-2.1211.4726-3.2813 1.3671-.4726.3633-.9648.8047-1.4726 1.3164-.043-.0508-.086-.1015-.1367-.1445-1.4454-1.2852-2.6602-2.082-3.6993-2.3906-.6171-.1836-1.1953-.1993-1.7226-.0235-.5586.1875-1.004.5742-1.3164 1.1172-.5156.8945-.6524 2.0742-.461 3.5274.0782.5898.2149 1.2343.4024 1.9335a1.1187 1.1187 0 0 0-.2149.047C3.008 8.621 1.711 9.2694.9258 10.0155c-.4649.4414-.7695.9375-.8828 1.4805-.1133.5781 0 1.1562.3125 1.6992.5156.8945 1.4648 1.5977 2.8164 2.1563.543.2226 1.1562.4257 1.8437.6093a1.0227 1.0227 0 0 0-.0703.2266c-.3906 1.8906-.4765 3.3438-.2226 4.3945.1484.629.4257 1.1407.8398 1.5078.4414.3907 1 .582 1.625.582 1.0352 0 2.121-.4726 3.2813-1.3632.4765-.3711.9726-.8164 1.4882-1.336a1.2 1.2 0 0 0 .1953.2266c1.4454 1.2852 2.6602 2.082 3.6993 2.3906.6172.1836 1.1953.1993 1.7226.0235.5586-.1875 1.004-.5742 1.3164-1.1172.5157-.8945.6524-2.0742.461-3.5273-.082-.6133-.2227-1.2813-.4258-2.0118a1.2248 1.2248 0 0 0 .2383-.0468c1.828-.6094 3.125-1.2578 3.9101-2.004.4649-.4413.7696-.9374.8828-1.4804.1133-.5781 0-1.1563-.3125-1.6992-.5156-.8946-1.4648-1.5977-2.8164-2.1563-.5586-.2304-1.1953-.4414-1.9062-.625a.8647.8647 0 0 0 .0586-.1953z" />
  </svg>
)

const ShadcnIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg role="img" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M22.219 11.784 11.784 22.219c-.407.407-.407 1.068 0 1.476.407.407 1.068.407 1.476 0L23.695 13.26c.407-.408.407-1.069 0-1.476-.408-.407-1.069-.407-1.476 0ZM20.132.305.305 20.132c-.407.407-.407 1.068 0 1.476.408.407 1.069.407 1.476 0L21.608 1.781c.407-.407.407-1.068 0-1.476-.408-.407-1.069-.407-1.476 0Z" />
  </svg>
)

interface FaqItem {
  question: string
  answer: string
}

const faqItems: Array<FaqItem> = [
  {
    question: 'TanStack là gì? Có miễn phí không?',
    answer:
      'TanStack (bao gồm TanStack Start, Router, Table, Form, Query) là một bộ thư viện quản lý trạng thái, định tuyến và hiển thị dữ liệu cực kỳ mạnh mẽ cho các ứng dụng React. Tất cả các thư viện của TanStack đều là mã nguồn mở hoàn toàn (MIT License) và miễn phí 100% cho mọi mục đích sử dụng.',
  },
  {
    question: 'Convex là gì? Có miễn phí không?',
    answer:
      'Convex là nền tảng cơ sở dữ liệu và backend thời gian thực (Real-time Cloud Backend) được tối ưu hóa riêng cho các ứng dụng React. Convex cung cấp gói miễn phí (Free Tier) rất rộng rãi, đủ dùng cho hầu hết các giáo xứ quy mô vừa và nhỏ. Bạn chỉ cần nâng cấp lên gói trả phí của họ khi lượng dữ liệu hoặc số lượng request vượt quá giới hạn cực lớn của gói miễn phí.',
  },
  {
    question: 'Các công nghệ khác trong Technical Stack thì sao?',
    answer:
      'Tất cả các công nghệ cốt lõi còn lại như React, Vite, Tailwind CSS, và Shadcn (Base UI) đều là mã nguồn mở, miễn phí hoàn toàn dưới giấy phép MIT. Bạn không phải trả bất kỳ khoản phí bản quyền nào để sử dụng chúng.',
  },
  {
    question:
      'Nếu dùng cho Giáo xứ lớn hàng ngàn học viên thì có miễn phí không? Tôi phải trả tiền cho ai?',
    answer:
      'Bản thân hệ thống eCCS là miễn phí hoàn toàn 100% và không thu phí bản quyền. Với quy mô lớn hàng ngàn học viên, bạn chỉ cần thanh toán chi phí vận hành hạ tầng thực tế cho các bên cung cấp dịch vụ máy chủ (như DigitalOcean, Hetzner, Vultr để chạy Web App chỉ khoảng $5-$10/tháng) và nâng cấp gói lưu trữ của Convex Cloud nếu lượng dữ liệu vượt quá gói free.',
  },
  {
    question:
      'Tôi có thể tự vận hành (Self-host) backend Convex trên máy chủ riêng không?',
    answer:
      'Hiện tại Convex cung cấp dịch vụ Cloud để tối ưu hóa hiệu năng đồng bộ thời gian thực và tự động scale. Tuy nhiên, Convex đã mở nguồn mở mã nguồn máy chủ của họ, cho phép lập trình viên có thể tự cấu hình và chạy self-host server Convex bằng Docker trên máy chủ riêng nếu muốn độc lập hoàn toàn.',
  },
  {
    question: 'Tôi có thể triển khai (deploy) ứng dụng này ở đâu?',
    answer:
      'Ứng dụng được xây dựng trên TanStack Start hỗ trợ xuất ra nhiều môi trường khác nhau. Bạn có thể deploy cực nhanh lên Vercel, Netlify, Fly.io, Railway, hoặc deploy lên bất cứ VPS riêng nào chạy Docker chỉ với vài câu lệnh.',
  },
  {
    question: 'Làm thế nào để tôi có thể đóng góp cho dự án?',
    answer:
      'Chúng tôi rất hoan nghênh sự đóng góp từ cộng đồng TNTT và các Huynh trưởng. Bạn có thể đóng góp bằng cách báo lỗi (Issues), đóng góp mã nguồn (Pull Requests) trên GitHub, hỗ trợ viết tài liệu hướng dẫn triển khai, hoặc giới thiệu eCCS tới các giáo xứ khác để lan tỏa tinh thần phục vụ.',
  },
]

interface FeatureItem {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const featureItems: Array<FeatureItem> = [
  {
    title: 'Quản lý Học viên & Hồ sơ',
    description:
      'Số hóa lý lịch cá nhân, thông tin liên lạc phụ huynh và theo dõi quá trình sinh hoạt của từng học viên.',
    icon: User,
  },
  {
    title: 'Huynh Trưởng & Phân quyền',
    description:
      'Quản lý hồ sơ Giáo lý viên chi tiết và phân quyền truy cập theo vai trò (Admin, Trưởng ngành, Huynh trưởng lớp).',
    icon: Users,
  },
  {
    title: 'Lịch sử Học tập & Năm học',
    description:
      'Lưu vết lịch sử năm học qua từng thời kỳ, theo dõi tiến trình thăng tiến phân ngành và kết quả lớp học qua các năm.',
    icon: History,
  },
  {
    title: 'Điểm danh Phiên đa dạng',
    description:
      'Hỗ trợ nhiều loại hình điểm danh linh hoạt như điểm danh Thánh Lễ Chúa Nhật, giờ học Giáo lý, hay các buổi sinh hoạt dã ngoại.',
    icon: Clock,
  },
  {
    title: 'Điểm số & Chuyên cần',
    description:
      'Tự động tổng hợp chuyên cần từ QR Code, quản lý điểm số theo học kỳ và tự động xếp loại học tập cuối năm.',
    icon: ClipboardCheck,
  },
  {
    title: 'Hồ sơ Bí tích Tích hợp',
    description:
      'Ghi nhận và lưu trữ chính xác các mốc Bí tích quan trọng của học viên bao gồm Rửa Tội, Rước Lễ Lần Đầu và Thêm Sức.',
    icon: Award,
  },
  {
    title: 'Lịch & Sự kiện Giáo xứ',
    description:
      'Đồng bộ hóa lịch học tập, lịch phụng vụ bổn mạng xứ đoàn và tổ chức các sự kiện thi đua, sinh hoạt ngoại khóa.',
    icon: Calendar,
  },
  {
    title: 'Chương trình ngoại khóa',
    description:
      'Dễ dàng quản lý các chương trình ngoại khóa, cho phép cả GLV lẫn HS đều có thể đăng ký.',
    icon: Tent,
  },
]

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const isAppLanding = clientEnv.VITE_APP_LANDING
  const { user } = useAuth()
  const [isDark, setIsDark] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
  }, [])

  useEffect(() => {
    const sectionIds = [
      'philosophy',
      'architecture',
      'features',
      'stack',
      'faq',
    ]
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as Array<HTMLElement>

    const intersectingSections = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            intersectingSections.add(entry.target.id)
          } else {
            intersectingSections.delete(entry.target.id)
          }
        })

        if (intersectingSections.size > 0) {
          let mostProminentId = ''
          let minDistance = Infinity

          intersectingSections.forEach((id) => {
            const el = document.getElementById(id)
            if (el) {
              const rect = el.getBoundingClientRect()
              const distance = Math.abs(rect.top)
              if (distance < minDistance) {
                minDistance = distance
                mostProminentId = id
              }
            }
          })

          if (mostProminentId) {
            setActiveSection(mostProminentId)
          }
        }
      },
      {
        rootMargin: '-10% 0px -40% 0px',
        threshold: 0,
      },
    )

    elements.forEach((el) => observer.observe(el))

    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveSection('')
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Set initial active state based on current scroll position
    handleScroll()

    return () => {
      elements.forEach((el) => observer.unobserve(el))
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (typeof window !== 'undefined') {
      if (nextDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  if (!isAppLanding) {
    // Redirect authenticated users directly to their dashboard
    return <Navigate to={user ? '/dashboard' : '/login'} />
  }

  return (
    <div className="bg-background text-foreground font-sans min-h-screen transition-colors duration-300">
      <style>{`
        .mesh-gradient {
          background-color: oklch(0.9838 0.0035 247.8583);
          background-image: 
            radial-gradient(at 10% 20%, rgba(122, 56, 203, 0.08) 0px, transparent 50%),
            radial-gradient(at 90% 10%, rgba(254, 209, 123, 0.12) 0px, transparent 50%),
            radial-gradient(at 50% 80%, rgba(108, 39, 189, 0.05) 0px, transparent 50%);
        }
        .dark .mesh-gradient {
          background-color: oklch(0.1091 0.0091 301.6956);
          background-image: 
            radial-gradient(at 10% 20%, rgba(122, 56, 203, 0.15) 0px, transparent 50%),
            radial-gradient(at 90% 10%, rgba(236, 192, 108, 0.08) 0px, transparent 50%),
            radial-gradient(at 50% 80%, rgba(108, 39, 189, 0.08) 0px, transparent 50%);
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .glass {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.25);
        }
        .dark .glass {
          background: rgba(20, 16, 28, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>

      {/* TopNavBar */}
      <header className="sticky top-0 w-full z-50 bg-white/70 dark:bg-card/60 backdrop-blur-md border-b border-border/80 dark:border-border/20 shadow-xs transition-all duration-300">
        <nav className="flex justify-between items-center px-6 py-4 max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="font-serif text-3xl text-primary dark:text-ring tracking-tight">
              eCCS
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {[
              { id: 'philosophy', label: 'Triết Lý' },
              { id: 'architecture', label: 'Kiến trúc' },
              { id: 'features', label: 'Tính Năng' },
              { id: 'stack', label: 'Technical Stack' },
              { id: 'faq', label: 'FAQ' },
            ].map((item) => {
              const isActive = activeSection === item.id
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`border-b-2 transition-colors duration-200 ${
                    isActive
                      ? 'text-amber-600 dark:text-amber-400 font-bold border-amber-500'
                      : 'text-muted-foreground hover:text-primary border-transparent'
                  }`}
                >
                  {item.label}
                </a>
              )
            })}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-muted transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-primary" />
              )}
            </button>
            <a
              className="text-muted-foreground hover:text-primary transition-colors"
              href="https://github.com/nguyenphucthanh/e-catholic-catechist-school"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GithubIcon className="w-5 h-5 text-primary" />
            </a>
            <Link
              to="/login"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 text-sm"
            >
              Đăng Nhập
            </Link>
          </div>
        </nav>
      </header>

      <main className="overflow-hidden">
        {/* Hero Section */}
        <section className="relative min-h-[720px] flex items-center pt-12 pb-20 mesh-gradient">
          <div className="relative z-10 max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
                  Dự Án Mã Nguồn Mở Quản Lý Trường Giáo Lý
                </span>
                <span className="inline-block px-2.5 py-1 bg-primary/10 text-primary dark:text-ring rounded-full text-xs font-semibold">
                  v{version}
                </span>
              </div>
              <h1 className="font-serif text-2xl lg:text-4xl text-foreground leading-tight">
                Nền Tảng Quản Lý Giáo Lý
                <br />
                <span className="text-primary dark:text-ring italic">
                  Hiện Đại
                </span>{' '}
                Cho Mọi Giáo Xứ
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                Một giải pháp mã nguồn mở mạnh mẽ, linh hoạt và bảo mật. Giúp
                các Huynh trưởng và Giáo xứ chuyển đổi số quy trình quản lý điểm
                danh, hồ sơ bí tích và kết nối phụ huynh một cách chuyên nghiệp.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link
                  to="/login"
                  className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold shadow-lg hover:shadow-primary/20 transition-all hover:-translate-y-1 flex items-center gap-2 group text-sm cursor-pointer"
                >
                  Vào Cổng Demo
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="https://github.com/nguyenphucthanh/e-catholic-catechist-school"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass px-8 py-3.5 rounded-xl text-primary dark:text-ring font-semibold hover:bg-muted/50 transition-all text-sm flex items-center gap-2"
                >
                  <GithubIcon className="w-4 h-4" />
                  GitHub
                </a>
              </div>
            </div>
            <div className="relative hidden lg:block justify-self-center">
              <div className="relative w-full max-w-[480px] h-auto animate-float">
                <img
                  alt="eCCS Sacred Modernity 3D Render"
                  className="w-full h-auto object-cover drop-shadow-2xl rounded-2xl transform transition-transform duration-700 hover:scale-[1.03]"
                  src="/stitch/hero.png"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Product Philosophy */}
        <section id="philosophy" className="py-20 bg-card scroll-mt-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-medium tracking-tight mb-2 text-foreground">
                Tại Sao Chọn eCCS?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto italic text-sm">
                Nền tảng được xây dựng dựa trên sự dấn thân và tinh thần phục vụ
                cộng đồng
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Open Source */}
              <div className="glass p-6 rounded-2xl border-t-4 border-primary hover:scale-105 transition-all cursor-pointer group">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Code className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Mã Nguồn Mở</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Hoàn toàn miễn phí và minh bạch. Cộng đồng có thể đóng góp và
                  kiểm tra mã nguồn bất cứ lúc nào.
                </p>
              </div>
              {/* Customization */}
              <div className="glass p-6 rounded-2xl border-t-4 border-amber-500 hover:scale-105 transition-all cursor-pointer group">
                <div className="bg-amber-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                  <Sliders className="w-6 h-6 text-amber-600 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Dễ Dàng Tùy Chỉnh
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Cấu trúc module linh hoạt, cho phép bạn thay đổi giao diện và
                  tính năng phù hợp với đặc thù giáo xứ.
                </p>
              </div>
              {/* Multi-platform */}
              <div className="glass p-6 rounded-2xl border-t-4 border-neutral-500 hover:scale-105 transition-all cursor-pointer group">
                <div className="bg-neutral-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors group-hover:bg-neutral-500 group-hover:text-white">
                  <Monitor className="w-6 h-6 text-neutral-600 dark:text-neutral-300 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Triển Khai Đa Nền Tảng
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Chạy tốt trên Web, Android và iOS. Hỗ trợ Docker giúp việc
                  deploy lên server chỉ mất vài phút.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-20 bg-muted/30">
          <div className="max-w-[1200px] mx-auto px-6">
            <div
              id="architecture"
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center scroll-mt-20"
            >
              {/* Left Column: Feature Showcase */}
              <div className="lg:col-span-7 flex flex-col justify-center space-y-6 lg:pr-6">
                <div className="space-y-4">
                  <h3 className="font-serif text-4xl text-foreground leading-tight">
                    Kiến Trúc{' '}
                    <span className="text-primary dark:text-ring italic">
                      Offline-First
                    </span>
                  </h3>
                  <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                    Điểm danh và xử lý dữ liệu ngay cả khi không có kết nối
                    Internet. Hệ thống tự động đồng bộ hóa thông minh khi thiết
                    bị online trở lại, đảm bảo công việc không bao giờ bị gián
                    đoạn.
                  </p>
                </div>
                <div className="flex flex-wrap gap-6 pt-2">
                  <div className="flex items-center gap-2 text-primary dark:text-ring font-semibold text-sm">
                    <Database className="w-5 h-5" />
                    <span>Lưu trữ cục bộ</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary dark:text-ring font-semibold text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin-[spin_3s_linear_infinite]" />
                    <span>Tự động đồng bộ</span>
                  </div>
                </div>
              </div>
              {/* Right Column: Image */}
              <div className="lg:col-span-5 justify-self-center">
                <div className="relative rounded-[2rem] overflow-hidden shadow-2xl transform hover:scale-[1.03] transition-transform duration-700 max-w-[360px]">
                  <img
                    alt="Modern smartphone scanning QR code"
                    className="w-full h-auto object-cover"
                    src="/stitch/qr_scan_phone.png"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Row: 4-Column Feature Grid (now with 8 items) */}
            <div
              id="features"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 scroll-mt-20"
            >
              {featureItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={index}
                    className="glass p-6 rounded-2xl hover:bg-white/80 dark:hover:bg-card/85 hover:shadow-lg transition-all group"
                  >
                    <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Technical Stack */}
        <section id="stack" className="py-20 bg-card scroll-mt-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-medium tracking-tight mb-2 text-foreground">
                Technical Stack
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto italic text-sm">
                Công nghệ hiện đại cho hiệu năng và bảo mật tối ưu
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="glass p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors">
                <TanstackIcon className="size-16 text-primary mb-2" />
                <span className="font-bold text-sm text-foreground">
                  Tanstack Start
                </span>
              </div>
              <div className="glass p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors">
                <ConvexIcon className="size-16 text-primary mb-2" />
                <span className="font-bold text-sm text-foreground">
                  Convex
                </span>
              </div>
              <div className="glass p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors">
                <ShadcnIcon className="size-16 text-primary mb-2" />
                <span className="font-bold text-sm text-foreground">
                  Shadcn (Base UI)
                </span>
              </div>
              <div className="glass p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors">
                <TailwindIcon className="size-16 text-primary mb-2" />
                <span className="font-bold text-sm text-foreground">
                  Tailwind CSS
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20 bg-muted/10 scroll-mt-20">
          <div className="max-w-[768px] mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-medium tracking-tight mb-2 text-foreground">
                Câu Hỏi Kỹ Thuật
              </h2>
            </div>
            <div className="space-y-4">
              {faqItems.map((faq, index) => (
                <details
                  key={index}
                  className="group glass rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden border border-border/50 dark:border-white/5"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer transition-colors hover:bg-accent/20">
                    <h4 className="text-base font-semibold">{faq.question}</h4>
                    <ChevronDown className="w-5 h-5 text-primary group-open:-rotate-180 transition-transform duration-300" />
                  </summary>
                  <div className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-card border-t border-border/50 dark:border-border/10 transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-6 max-w-[1200px] mx-auto text-center md:text-left items-start">
          <div className="space-y-3">
            <span className="font-serif text-2xl text-amber-600 dark:text-amber-400">
              eCCS
            </span>
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              "Công nghệ phục vụ Đức Tin - Mã nguồn vì Cộng Đồng."
            </p>
            <p className="leading-relaxed">
              eCCS - tên đầy đủ là e-Catholic Catechist School. Một giải pháp
              quản lý trường giáo lý, xứ đoàn với quy mô vừa và nhỏ.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-primary dark:text-ring uppercase text-xs tracking-widest">
              Tài Nguyên
            </h4>
            <ul className="space-y-1 text-sm">
              <li>
                <a
                  className="text-muted-foreground hover:text-primary transition-colors"
                  href="https://github.com/nguyenphucthanh/e-catholic-catechist-school"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-primary transition-colors"
                  to="/help"
                >
                  Trung Tâm Trợ Giúp
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-primary dark:text-ring uppercase text-xs tracking-widest">
              Liên Hệ
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dự án được duy trì bởi{' '}
              <a
                href="https://github.com/nguyenphucthanh/e-catholic-catechist-school"
                className="text-primary hover:text-primary transition-colors"
              >
                JB Nguyễn Phúc Thanh
              </a>
              . Mọi thắc mắc vui lòng tạo Issue trên kho mã nguồn chính thức.
            </p>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto px-6 mt-12 pt-6 border-t border-border/10 dark:border-border/20 text-center">
          <p className="text-sm text-muted-foreground">© 2026 eCCS Project</p>
        </div>
      </footer>
    </div>
  )
}
