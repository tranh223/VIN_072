import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type TourStep = {
  id: string;
  page: string;
  target: string;
  title: string;
  body: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
};

type ProductTourProps = {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  activePage: string;
  page: string;
  mode?: 'page' | 'menu';
};

const MENU_TOUR_STEPS: TourStep[] = [
  {
    id: 'menu-shops',
    page: 'home',
    target: 'sidebar-shops',
    title: 'Cá»­a hÃ ng',
    body: 'Quáº£n lÃ½ danh sÃ¡ch shop trÆ°á»›c khi táº£i dá»¯ liá»‡u. Má»—i shop cÃ³ há»“ sÆ¡, bÃ¡o cÃ¡o vÃ  tráº¡ng thÃ¡i Ä‘á»‘i soÃ¡t riÃªng.',
    placement: 'right',
  },
  {
    id: 'menu-documents',
    page: 'home',
    target: 'sidebar-documents',
    title: 'Há»“ sÆ¡ / Chá»©ng tá»«',
    body: 'Kho lÆ°u trá»¯ cÃ¡c file Ä‘Ã£ upload, Ä‘Ã£ Ä‘á»‘i soÃ¡t vÃ  Ä‘Ã£ xÃ¡c nháº­n theo shop, ká»³, loáº¡i chá»©ng tá»« vÃ  tráº¡ng thÃ¡i.',
    placement: 'right',
  },
  {
    id: 'menu-upload',
    page: 'home',
    target: 'sidebar-upload',
    title: 'Táº£i lÃªn',
    body: 'Táº£i CSV doanh thu vÃ  chá»©ng tá»« áº£nh/PDF Ä‘á»ƒ há»‡ thá»‘ng trÃ­ch xuáº¥t, Ä‘á»‘i soÃ¡t vÃ  cáº­p nháº­t há»“ sÆ¡.',
    placement: 'right',
  },
  {
    id: 'menu-reports',
    page: 'home',
    target: 'sidebar-reports',
    title: 'BÃ¡o cÃ¡o thÃ¡ng',
    body: 'Xem tá»•ng há»£p doanh thu, cáº£nh bÃ¡o, thuáº¿ tham kháº£o vÃ  xu hÆ°á»›ng theo tá»«ng ká»³.',
    placement: 'right',
  },
  {
    id: 'menu-yearend',
    page: 'home',
    target: 'sidebar-yearend',
    title: 'Há»“ sÆ¡ cuá»‘i nÄƒm',
    body: 'Theo dÃµi checklist cuá»‘i nÄƒm vÃ  má»©c sáºµn sÃ ng Ä‘á»ƒ chá»‘t há»“ sÆ¡.',
    placement: 'right',
  },
  {
    id: 'menu-compliance',
    page: 'home',
    target: 'sidebar-compliance',
    title: 'Äiá»ƒm tuÃ¢n thá»§',
    body: 'ÄÃ¡nh giÃ¡ má»©c sáºµn sÃ ng há»“ sÆ¡ vÃ  xem cÃ¡c tiÃªu chÃ­ Ä‘ang áº£nh hÆ°á»Ÿng tá»›i Ä‘iá»ƒm.',
    placement: 'right',
  },
  {
    id: 'menu-audit',
    page: 'home',
    target: 'sidebar-audit',
    title: 'Nháº­t kÃ½ kiá»ƒm toÃ¡n',
    body: 'Truy váº¿t ai Ä‘Ã£ thao tÃ¡c gÃ¬, trÃªn Ä‘á»‘i tÆ°á»£ng nÃ o vÃ  vÃ o thá»i Ä‘iá»ƒm nÃ o.',
    placement: 'right',
  },
  {
    id: 'menu-history',
    page: 'home',
    target: 'sidebar-history',
    title: 'Lá»‹ch sá»­ phiÃªn',
    body: 'Theo dÃµi toÃ n bá»™ phiÃªn xá»­ lÃ½, tráº¡ng thÃ¡i, cáº£nh bÃ¡o vÃ  thao tÃ¡c review.',
    placement: 'right',
  },
];

const PAGE_TOUR_STEPS: Record<string, TourStep[]> = {
  home: [
    { id: 'home-welcome', page: 'home', target: 'home-welcome', title: 'Báº¯t Ä‘áº§u tá»« tá»•ng quan', body: 'Dashboard gom lá»i chÃ o, tráº¡ng thÃ¡i há»“ sÆ¡ vÃ  cÃ¡c lá»‘i táº¯t quan trá»ng Ä‘á»ƒ báº¯t Ä‘áº§u cÃ´ng viá»‡c.', placement: 'bottom' },
    { id: 'home-guide', page: 'home', target: 'home-guide-button', title: 'HÆ°á»›ng dáº«n cÃ¡c bÆ°á»›c', body: 'NÃºt nÃ y má»Ÿ hÆ°á»›ng dáº«n cho Ä‘Ãºng trang báº¡n Ä‘ang Ä‘á»©ng.', placement: 'bottom' },
    { id: 'home-hero', page: 'home', target: 'home-hero', title: 'Ngá»¯ cáº£nh há»“ sÆ¡ ká»³ nÃ y', body: 'Khu vá»±c nÃ y cho biáº¿t báº¡n Ä‘ang theo dÃµi má»™t shop hay nhiá»u shop, ká»³ gáº§n nháº¥t vÃ  thao tÃ¡c tiáº¿p theo.', placement: 'bottom' },
    { id: 'home-quick-actions', page: 'home', target: 'home-quick-actions', title: 'Thao tÃ¡c nhanh', body: 'Menu Ä‘i nhanh tá»›i Ä‘á»‘i soÃ¡t, bÃ¡o cÃ¡o thÃ¡ng hoáº·c há»“ sÆ¡ cuá»‘i nÄƒm theo shop hiá»‡n táº¡i.', placement: 'left' },
    { id: 'home-kpis', page: 'home', target: 'home-kpis', title: 'KPI tá»•ng quan', body: 'CÃ¡c Ã´ KPI tá»•ng há»£p file Ä‘Ã£ xÃ¡c nháº­n, file cáº§n xem láº¡i, há»“ sÆ¡ cÃ²n thiáº¿u hoáº·c tráº¡ng thÃ¡i nhiá»u shop.', placement: 'bottom' },
    { id: 'home-checklist', page: 'home', target: 'home-checklist', title: 'Checklist há»“ sÆ¡', body: 'Checklist cho biáº¿t má»¥c Ä‘Ã£ Ä‘áº¡t vÃ  má»¥c cÃ²n thiáº¿u. CÃ³ thá»ƒ lá»c riÃªng má»¥c cÃ²n thiáº¿u Ä‘á»ƒ xá»­ lÃ½ nhanh.', placement: 'right' },
    { id: 'home-recent-document', page: 'home', target: 'home-recent-document', title: 'Chá»©ng tá»« gáº§n nháº¥t', body: 'Hiá»ƒn thá»‹ file gáº§n nháº¥t trong kho há»“ sÆ¡ cÃ¹ng ká»³, loáº¡i vÃ  tráº¡ng thÃ¡i xÃ¡c nháº­n.', placement: 'left' },
    { id: 'home-risk-shop', page: 'home', target: 'home-risk-shop', title: 'Shop cáº§n Æ°u tiÃªn', body: 'Vá»›i nhiá»u shop, há»‡ thá»‘ng gá»£i Ã½ shop rá»§i ro nháº¥t Ä‘á»ƒ Æ°u tiÃªn bá»• sung chá»©ng tá»« hoáº·c kiá»ƒm tra sá»©c khá»e há»“ sÆ¡.', placement: 'right' },
    { id: 'home-trend', page: 'home', target: 'home-trend', title: 'Tá»•ng há»£p theo ká»³', body: 'Biá»ƒu Ä‘á»“ xu hÆ°á»›ng giÃºp nhÃ¬n doanh thu vÃ  thuáº¿ tham kháº£o qua cÃ¡c ká»³ Ä‘Ã£ cÃ³ dá»¯ liá»‡u.', placement: 'left' },
    { id: 'home-alerts', page: 'home', target: 'home-alerts', title: 'Cáº£nh bÃ¡o Ä‘á»‘i soÃ¡t', body: 'CÃ¡c cáº£nh bÃ¡o má»›i nháº¥t nhÆ° lá»‡ch CSV/chá»©ng tá»«, thiáº¿u thÃ´ng tin hoáº·c ngÆ°á»¡ng doanh thu cáº§n chÃº Ã½.', placement: 'bottom' },
    { id: 'home-session-alerts', page: 'home', target: 'home-session-alerts', title: 'Cáº£nh bÃ¡o phiÃªn xá»­ lÃ½', body: 'Gom phiÃªn lá»—i vÃ  phiÃªn Ä‘ang cháº¡y Ä‘á»ƒ má»Ÿ nhanh Upload/Review hoáº·c Lá»‹ch sá»­ phiÃªn.', placement: 'bottom' },
    { id: 'home-empty-start', page: 'home', target: 'home-empty-start', title: 'Báº¯t Ä‘áº§u khi chÆ°a cÃ³ dá»¯ liá»‡u', body: 'Vá»›i tÃ i khoáº£n má»›i, Ä‘Ã¢y lÃ  Ä‘iá»ƒm nháº¯c thÃªm shop Ä‘áº§u tiÃªn trÆ°á»›c khi upload vÃ  Ä‘á»‘i soÃ¡t.', placement: 'top' },
    { id: 'home-support', page: 'home', target: 'topbar-support', title: 'ThÃ´ng tin phá»¥ trá»£', body: 'Má»Ÿ panel phá»¥ trá»£ Ä‘á»ƒ xem gá»£i Ã½, cáº­p nháº­t sáº£n pháº©m, lá»‘i táº¯t vÃ  nÃºt hÆ°á»›ng dáº«n cá»§a trang hiá»‡n táº¡i.', placement: 'bottom' },
    { id: 'home-assistant', page: 'home', target: 'sidebar-kaify-bot', title: 'Kaify Bot vÃ  gÃ³p Ã½', body: 'Má»Ÿ Kaify Bot hoáº·c gá»­i gÃ³p Ã½ tá»« khu vá»±c cuá»‘i sidebar.', placement: 'right' },
  ],
  shops: [
    { id: 'shops-header', page: 'shops', target: 'shops-header', title: 'Danh má»¥c shop', body: 'Trang khai bÃ¡o vÃ  quáº£n lÃ½ cÃ¡c cá»­a hÃ ng trÆ°á»›c khi upload dá»¯ liá»‡u.', placement: 'bottom' },
    { id: 'shops-table', page: 'shops', target: 'shops-table', title: 'Báº£ng shop', body: 'Báº£ng hiá»ƒn thá»‹ ná»n táº£ng, tráº¡ng thÃ¡i Ä‘á»‘i soÃ¡t, cáº£nh bÃ¡o, chá»©ng tá»«, ká»³ gáº§n nháº¥t vÃ  thao tÃ¡c upload.', placement: 'top' },
  ],
  upload: [
    { id: 'upload-header', page: 'upload', target: 'upload-header', title: 'Bá»™ dá»¯ liá»‡u ká»³', body: 'Trang Upload lÃ  nÆ¡i chá»n shop, ká»³ bÃ¡o cÃ¡o, loáº¡i phiÃªn vÃ  gá»­i file Ä‘á»ƒ trÃ­ch xuáº¥t Ä‘á»‘i soÃ¡t.', placement: 'bottom' },
    { id: 'upload-classification', page: 'upload', target: 'upload-classification', title: 'PhÃ¢n loáº¡i chá»©ng tá»«', body: 'Chá»n cá»­a hÃ ng, thÃ¡ng nÄƒm, loáº¡i phiÃªn upload vÃ  loáº¡i chá»©ng tá»« Ä‘á»ƒ lÆ°u metadata Ä‘Ãºng.', placement: 'bottom' },
    { id: 'upload-dropzone', page: 'upload', target: 'upload-dropzone', title: 'Khu vá»±c táº£i file', body: 'KÃ©o tháº£ hoáº·c chá»n CSV doanh thu, chá»©ng tá»« áº£nh/PDF vÃ  file máº«u CSV tá»« khu vá»±c nÃ y.', placement: 'right' },
    { id: 'upload-file-requirements', page: 'upload', target: 'upload-file-requirements', title: 'YÃªu cáº§u file', body: 'Cá»™t bÃªn pháº£i nháº¯c loáº¡i file há»£p lá»‡, dá»¯ liá»‡u cáº§n cÃ³ vÃ  cÃ¡ch chuáº©n bá»‹ chá»©ng tá»«.', placement: 'left' },
    { id: 'upload-sales-summary', page: 'upload', target: 'upload-sales-summary', title: 'Dá»¯ liá»‡u bÃ¡n hÃ ng', body: 'Sau khi xá»­ lÃ½, doanh thu CSV, ngÃ nh hÃ ng, ká»³ vÃ  nguá»“n Ä‘Æ°á»£c tá»•ng há»£p táº¡i Ä‘Ã¢y.', placement: 'right' },
    { id: 'upload-evidence-summary', page: 'upload', target: 'upload-evidence-summary', title: 'Chá»©ng tá»« giao dá»‹ch', body: 'Káº¿t quáº£ OCR/VLM giÃºp Ä‘á»‘i chiáº¿u doanh thu, ngÃ y giao dá»‹ch, Ä‘á»‘i tÃ¡c, mÃ£ Ä‘Æ¡n hÃ ng vÃ  MST.', placement: 'right' },
    { id: 'upload-history-link', page: 'upload', target: 'upload-history-link', title: 'LiÃªn káº¿t Lá»‹ch sá»­ phiÃªn', body: 'Khi cáº§n xem toÃ n bá»™ phiÃªn Ä‘Ã£ xá»­ lÃ½, Ä‘i tá»›i Lá»‹ch sá»­ phiÃªn tá»« Ä‘Ã¢y.', placement: 'right' },
  ],
  documents: [
    { id: 'documents-header', page: 'documents', target: 'documents-header', title: 'Kho Há»“ sÆ¡ / Chá»©ng tá»«', body: 'Trang lÆ°u cÃ¡c file Ä‘Ã£ upload, Ä‘Ã£ Ä‘á»‘i soÃ¡t vÃ  Ä‘Ã£ xÃ¡c nháº­n.', placement: 'bottom' },
    { id: 'documents-filters', page: 'documents', target: 'documents-filters', title: 'Bá»™ lá»c há»“ sÆ¡', body: 'Lá»c theo ká»³, shop, loáº¡i chá»©ng tá»«, tráº¡ng thÃ¡i vÃ  nguá»“n Ä‘á»ƒ tÃ¬m file nhanh.', placement: 'bottom' },
    { id: 'documents-table', page: 'documents', target: 'documents-table', title: 'Danh sÃ¡ch chá»©ng tá»«', body: 'Báº£ng cho biáº¿t tÃªn file, shop, ká»³, loáº¡i, tráº¡ng thÃ¡i, thá»i Ä‘iá»ƒm upload/xÃ¡c nháº­n vÃ  thao tÃ¡c má»Ÿ táº£i file.', placement: 'top' },
    { id: 'documents-hint', page: 'documents', target: 'documents-hint', title: 'Gá»£i Ã½ liÃªn káº¿t', body: 'Tá»« kho há»“ sÆ¡, cÃ³ thá»ƒ chuyá»ƒn nhanh sang Lá»‹ch sá»­ phiÃªn hoáº·c checklist cuá»‘i nÄƒm.', placement: 'top' },
  ],
  history: [
    { id: 'history-header', page: 'history', target: 'history-header', title: 'Lá»‹ch sá»­ phiÃªn xá»­ lÃ½', body: 'Má»—i dÃ²ng lÃ  má»™t phiÃªn xá»­ lÃ½, ká»³ bÃ¡o cÃ¡o, loáº¡i phiÃªn, tráº¡ng thÃ¡i há»“ sÆ¡ vÃ  sá»‘ liá»‡u tham kháº£o.', placement: 'bottom' },
    { id: 'history-table', page: 'history', target: 'history-table', title: 'Báº£ng phiÃªn', body: 'Má»Ÿ Review Ä‘á»ƒ xem láº¡i chi tiáº¿t phiÃªn, hoáº·c má»Ÿ file nguá»“n náº¿u cÃ³.', placement: 'top' },
    { id: 'history-hint', page: 'history', target: 'history-hint', title: 'Gá»£i Ã½ sau upload', body: 'Sau khi upload thÃ nh cÃ´ng, má»Ÿ Sá»©c khá»e há»“ sÆ¡ hoáº·c BÃ¡o cÃ¡o thÃ¡ng Ä‘á»ƒ xem káº¿t quáº£ tá»•ng há»£p.', placement: 'top' },
  ],
  audit: [
    { id: 'audit-header', page: 'audit', target: 'audit-header', title: 'Nháº­t kÃ½ thay Ä‘á»•i', body: 'Trang audit giÃºp truy váº¿t ai Ä‘Ã£ lÃ m gÃ¬, vá»›i Ä‘á»‘i tÆ°á»£ng nÃ o vÃ  vÃ o thá»i Ä‘iá»ƒm nÃ o.', placement: 'bottom' },
    { id: 'audit-table', page: 'audit', target: 'audit-table', title: 'Báº£ng nháº­t kÃ½', body: 'Báº£ng ghi láº¡i ngÆ°á»i dÃ¹ng, hÃ nh Ä‘á»™ng, Ä‘á»‘i tÆ°á»£ng thao tÃ¡c, sá»‘ trÆ°á»ng thay Ä‘á»•i vÃ  thá»i gian.', placement: 'top' },
  ],
  compliance: [
    { id: 'compliance-header', page: 'compliance', target: 'compliance-header', title: 'Má»©c sáºµn sÃ ng há»“ sÆ¡', body: 'Trang Ä‘Ã¡nh giÃ¡ má»©c sáºµn sÃ ng dá»¯ liá»‡u vÃ  há»“ sÆ¡ dá»±a trÃªn thiáº¿u dá»¯ liá»‡u, lá»‡ch dá»¯ liá»‡u vÃ  cÃ¡c má»¥c cáº§n xÃ¡c nháº­n.', placement: 'bottom' },
    { id: 'compliance-score', page: 'compliance', target: 'compliance-score', title: 'Äiá»ƒm tá»•ng quÃ¡t', body: 'Äiá»ƒm 0-100 giÃºp Æ°u tiÃªn há»“ sÆ¡ rá»§i ro, há»“ sÆ¡ cáº§n kiá»ƒm tra vÃ  há»“ sÆ¡ sáºµn sÃ ng kÃª khai.', placement: 'right' },
    { id: 'compliance-details', page: 'compliance', target: 'compliance-details', title: 'Chi tiáº¿t Ä‘iá»ƒm', body: 'CÃ¡c thanh chi tiáº¿t giáº£i thÃ­ch Ä‘iá»ƒm bá»‹ áº£nh hÆ°á»Ÿng bá»Ÿi tiÃªu chÃ­ nÃ o vÃ  gá»£i Ã½ mÃ n hÃ¬nh cáº§n xá»­ lÃ½.', placement: 'left' },
  ],
  reports: [
    { id: 'reports-header', page: 'reports', target: 'reports-header', title: 'Há»“ sÆ¡ thÃ¡ng', body: 'BÃ¡o cÃ¡o thÃ¡ng tá»•ng há»£p doanh thu, cáº£nh bÃ¡o, thuáº¿ tham kháº£o vÃ  tráº¡ng thÃ¡i há»“ sÆ¡.', placement: 'bottom' },
    { id: 'reports-kpis', page: 'reports', target: 'reports-kpis', title: 'KPI bÃ¡o cÃ¡o thÃ¡ng', body: 'CÃ¡c tháº» tá»•ng há»£p doanh thu thuáº§n, cáº£nh bÃ¡o, thuáº¿ tham kháº£o vÃ  tá»· lá»‡ theo dÃµi ngÆ°á»¡ng.', placement: 'bottom' },
    { id: 'reports-revenue-trend', page: 'reports', target: 'reports-revenue-trend', title: 'Xu hÆ°á»›ng doanh thu', body: 'Biá»ƒu Ä‘á»“ giÃºp xem doanh thu theo thÃ¡ng tá»« cÃ¡c dá»¯ liá»‡u Ä‘Ã£ Ä‘á»‘i soÃ¡t.', placement: 'right' },
    { id: 'reports-ai-summary', page: 'reports', target: 'reports-ai-summary', title: 'PhÃ¢n tÃ­ch AI vÃ  ngÆ°á»¡ng', body: 'Khá»‘i tá»•ng há»£p phÃ¡t hiá»‡n, má»¥c cáº§n kiá»ƒm tra, Ä‘á» xuáº¥t xá»­ lÃ½ vÃ  nÃºt táº£i bÃ¡o cÃ¡o náº¿u cÃ³ phiÃªn.', placement: 'left' },
    { id: 'reports-alerts', page: 'reports', target: 'reports-alerts', title: 'Cáº£nh bÃ¡o tá»« phiÃªn', body: 'Danh sÃ¡ch cáº£nh bÃ¡o theo mÃ£, ná»™i dung, má»©c Ä‘á»™ vÃ  tráº¡ng thÃ¡i Ä‘á»ƒ má»Ÿ giáº£i thÃ­ch hoáº·c chá»‰nh sá»‘.', placement: 'top' },
  ],
  yearend: [
    { id: 'yearend-header', page: 'yearend', target: 'yearend-header', title: 'Há»“ sÆ¡ cuá»‘i nÄƒm', body: 'Trang cuá»‘i nÄƒm táº­p trung vÃ o checklist vÃ  má»©c sáºµn sÃ ng Ä‘á»ƒ chá»‘t nÄƒm.', placement: 'bottom' },
    { id: 'yearend-kpis', page: 'yearend', target: 'yearend-kpis', title: 'Tá»•ng quan cuá»‘i nÄƒm', body: 'CÃ¡c tháº» tá»•ng há»£p doanh thu, giÃ¡ trá»‹ Ä‘Ã£ ghi nháº­n vÃ  sá»‘ há»“ sÆ¡ Ä‘Ã£ hoÃ n thÃ nh.', placement: 'bottom' },
    { id: 'yearend-checklist', page: 'yearend', target: 'yearend-checklist', title: 'Checklist há»“ sÆ¡ cuá»‘i nÄƒm', body: 'Checklist cho biáº¿t má»¥c nÃ o Ä‘Ã£ xong, má»¥c nÃ o cÃ²n thiáº¿u vÃ  cÃ³ thá»ƒ lá»c riÃªng nhá»¯ng má»¥c cáº§n lÃ m.', placement: 'right' },
    { id: 'yearend-readiness', page: 'yearend', target: 'yearend-readiness', title: 'Má»©c sáºµn sÃ ng kiá»ƒm toÃ¡n', body: 'VÃ²ng tiáº¿n Ä‘á»™ thá»ƒ hiá»‡n má»©c sáºµn sÃ ng cuá»‘i nÄƒm vÃ  nÃºt chuyá»ƒn nhanh tá»›i checklist hoáº·c kho chá»©ng tá»«.', placement: 'left' },
  ],
  settings: [
    { id: 'settings-header', page: 'settings', target: 'settings-header', title: 'CÃ i Ä‘áº·t tÃ i khoáº£n', body: 'Trang cÃ i Ä‘áº·t dÃ¹ng Ä‘á»ƒ quáº£n lÃ½ thÃ´ng tin Ä‘Äƒng nháº­p, áº£nh Ä‘áº¡i diá»‡n vÃ  báº£o máº­t tÃ i khoáº£n.', placement: 'bottom' },
    { id: 'settings-profile', page: 'settings', target: 'settings-profile', title: 'ThÃ´ng tin cÃ¡ nhÃ¢n', body: 'Khu vá»±c nÃ y hiá»ƒn thá»‹ tÃªn vÃ  email Ä‘ang dÃ¹ng Ä‘á»ƒ nháº­n diá»‡n tÃ i khoáº£n trong há»‡ thá»‘ng.', placement: 'right' },
    { id: 'settings-password', page: 'settings', target: 'settings-password', title: 'Máº­t kháº©u', body: 'Äá»•i máº­t kháº©u Ä‘á»‹nh ká»³ Ä‘á»ƒ giá»¯ tÃ i khoáº£n an toÃ n.', placement: 'right' },
    { id: 'settings-avatar', page: 'settings', target: 'settings-avatar', title: 'áº¢nh Ä‘áº¡i diá»‡n', body: 'Táº£i áº£nh Ä‘áº¡i diá»‡n má»›i Ä‘á»ƒ cáº­p nháº­t hÃ¬nh áº£nh tÃ i khoáº£n.', placement: 'left' },
  ],
};

const STORAGE_KEY = 'scaify.productTour.dismissed';
const STEP_CHANGE_DELAY_MS = 180;
const TEXT = {
  closeProductTour: '\u0110\u00f3ng product tour',
  close: '\u0110\u00f3ng',
  previousStep: 'B\u01b0\u1edbc tr\u01b0\u1edbc',
  cancel: 'H\u1ee7y',
  finish: 'Ho\u00e0n t\u1ea5t',
  next: 'Ti\u1ebfp',
};

const HOME_TOUR_STEP_IDS = new Set([
  'home-welcome',
  'home-guide',
  'home-kpis',
  'home-checklist',
  'home-support',
  'home-assistant',
]);

const TOUR_TEXT_OVERRIDES: Record<string, Pick<TourStep, 'title' | 'body'>> = {
  'menu-shops': {
    title: 'Cửa hàng',
    body: 'Quản lý danh sách shop trước khi tải dữ liệu. Mỗi shop có hồ sơ, báo cáo và trạng thái đối soát riêng.',
  },
  'menu-documents': {
    title: 'Hồ sơ / Chứng từ',
    body: 'Kho lưu trữ file đã upload, đã đối soát và đã xác nhận theo shop, kỳ, loại chứng từ và trạng thái.',
  },
  'menu-upload': {
    title: 'Tải lên',
    body: 'Tải CSV doanh thu và chứng từ ảnh/PDF để hệ thống trích xuất, đối soát và cập nhật hồ sơ.',
  },
  'menu-reports': {
    title: 'Báo cáo tháng',
    body: 'Xem tổng hợp doanh thu, cảnh báo, thuế tham khảo và xu hướng theo từng kỳ.',
  },
  'menu-yearend': {
    title: 'Hồ sơ cuối năm',
    body: 'Theo dõi checklist cuối năm và mức sẵn sàng để chốt hồ sơ.',
  },
  'menu-compliance': {
    title: 'Điểm tuân thủ',
    body: 'Đánh giá mức sẵn sàng hồ sơ và các tiêu chí đang ảnh hưởng tới điểm.',
  },
  'menu-audit': {
    title: 'Nhật ký kiểm toán',
    body: 'Truy vết ai đã thao tác gì, trên đối tượng nào và vào thời điểm nào.',
  },
  'menu-history': {
    title: 'Lịch sử phiên',
    body: 'Theo dõi toàn bộ phiên xử lý, trạng thái, cảnh báo và thao tác review.',
  },
  'home-welcome': {
    title: 'Bắt đầu từ tổng quan',
    body: 'Dashboard gom lời chào, trạng thái hồ sơ và các lối tắt quan trọng để bắt đầu công việc.',
  },
  'home-guide': {
    title: 'Hướng dẫn các bước',
    body: 'Nút này mở hướng dẫn cho đúng trang bạn đang đứng.',
  },
  'home-hero': {
    title: 'Ngữ cảnh hồ sơ kỳ này',
    body: 'Khu vực này cho biết bạn đang theo dõi một shop hay nhiều shop, kỳ gần nhất và thao tác tiếp theo.',
  },
  'home-quick-actions': {
    title: 'Thao tác nhanh',
    body: 'Menu đi nhanh tới đối soát, báo cáo tháng hoặc hồ sơ cuối năm theo shop hiện tại.',
  },
  'home-kpis': {
    title: 'KPI tổng quan',
    body: 'Các ô KPI tổng hợp file đã xác nhận, file cần xem lại, hồ sơ còn thiếu hoặc trạng thái nhiều shop.',
  },
  'home-checklist': {
    title: 'Checklist hồ sơ',
    body: 'Checklist cho biết mục đã đạt và mục còn thiếu. Có thể lọc riêng mục còn thiếu để xử lý nhanh.',
  },
  'home-recent-document': {
    title: 'Chứng từ gần nhất',
    body: 'Hiển thị file gần nhất trong kho hồ sơ cùng kỳ, loại và trạng thái xác nhận.',
  },
  'home-risk-shop': {
    title: 'Shop cần ưu tiên',
    body: 'Với nhiều shop, hệ thống gợi ý shop rủi ro nhất để ưu tiên bổ sung chứng từ hoặc kiểm tra hồ sơ.',
  },
  'home-trend': {
    title: 'Tổng hợp theo kỳ',
    body: 'Biểu đồ xu hướng giúp nhìn doanh thu và thuế tham khảo qua các kỳ đã có dữ liệu.',
  },
  'home-alerts': {
    title: 'Cảnh báo đối soát',
    body: 'Các cảnh báo mới nhất như lệch CSV/chứng từ, thiếu thông tin hoặc ngưỡng doanh thu cần chú ý.',
  },
  'home-session-alerts': {
    title: 'Cảnh báo phiên xử lý',
    body: 'Gom phiên lỗi và phiên đang chạy để mở nhanh Upload/Review hoặc Lịch sử phiên.',
  },
  'home-empty-start': {
    title: 'Bắt đầu khi chưa có dữ liệu',
    body: 'Với tài khoản mới, đây là điểm nhắc thêm shop đầu tiên trước khi upload và đối soát.',
  },
  'home-support': {
    title: 'Thông tin phụ trợ',
    body: 'Mở panel phụ trợ để xem gợi ý, cập nhật sản phẩm, lối tắt và nút hướng dẫn của trang hiện tại.',
  },
  'home-assistant': {
    title: 'Kaify Bot và góp ý',
    body: 'Mở Kaify Bot hoặc gửi góp ý từ khu vực cuối sidebar.',
  },
  'shops-header': { title: 'Danh mục shop', body: 'Trang khai báo và quản lý các cửa hàng trước khi upload dữ liệu.' },
  'shops-table': { title: 'Bảng shop', body: 'Bảng hiển thị nền tảng, trạng thái đối soát, cảnh báo, chứng từ, kỳ gần nhất và thao tác upload.' },
  'upload-header': { title: 'Bộ dữ liệu kỳ', body: 'Trang Upload là nơi chọn shop, kỳ báo cáo, loại phiên và gửi file để trích xuất đối soát.' },
  'upload-classification': { title: 'Phân loại chứng từ', body: 'Chọn cửa hàng, tháng năm, loại phiên upload và loại chứng từ để lưu metadata đúng.' },
  'upload-dropzone': { title: 'Khu vực tải file', body: 'Kéo thả hoặc chọn CSV doanh thu, chứng từ ảnh/PDF và file mẫu CSV từ khu vực này.' },
  'upload-file-requirements': { title: 'Yêu cầu file', body: 'Cột bên phải nhắc loại file hợp lệ, dữ liệu cần có và cách chuẩn bị chứng từ.' },
  'upload-sales-summary': { title: 'Dữ liệu bán hàng', body: 'Sau khi xử lý, doanh thu CSV, ngành hàng, kỳ và nguồn được tổng hợp tại đây.' },
  'upload-evidence-summary': { title: 'Chứng từ giao dịch', body: 'Kết quả OCR/VLM giúp đối chiếu doanh thu, ngày giao dịch, đối tác, mã đơn hàng và MST.' },
  'upload-history-link': { title: 'Liên kết Lịch sử phiên', body: 'Khi cần xem toàn bộ phiên đã xử lý, đi tới Lịch sử phiên từ đây.' },
  'documents-header': { title: 'Kho Hồ sơ / Chứng từ', body: 'Trang lưu các file đã upload, đã đối soát và đã xác nhận.' },
  'documents-filters': { title: 'Bộ lọc hồ sơ', body: 'Lọc theo kỳ, shop, loại chứng từ, trạng thái và nguồn để tìm file nhanh.' },
  'documents-table': { title: 'Danh sách chứng từ', body: 'Bảng cho biết tên file, shop, kỳ, loại, trạng thái, thời điểm upload/xác nhận và thao tác tải file.' },
  'documents-hint': { title: 'Gợi ý liên kết', body: 'Từ kho hồ sơ, có thể chuyển nhanh sang Lịch sử phiên hoặc checklist cuối năm.' },
  'history-header': { title: 'Lịch sử phiên xử lý', body: 'Mỗi dòng là một phiên xử lý, kỳ báo cáo, loại phiên, trạng thái hồ sơ và số liệu tham khảo.' },
  'history-table': { title: 'Bảng phiên', body: 'Mở Review để xem lại chi tiết phiên, hoặc mở file nguồn nếu có.' },
  'history-hint': { title: 'Gợi ý sau upload', body: 'Sau khi upload thành công, mở Sức khỏe hồ sơ hoặc Báo cáo tháng để xem kết quả tổng hợp.' },
  'audit-header': { title: 'Nhật ký thay đổi', body: 'Trang audit giúp truy vết ai đã làm gì, với đối tượng nào và vào thời điểm nào.' },
  'audit-table': { title: 'Bảng nhật ký', body: 'Bảng ghi lại người dùng, hành động, đối tượng thao tác, số trường thay đổi và thời gian.' },
  'compliance-header': { title: 'Mức sẵn sàng hồ sơ', body: 'Trang đánh giá mức sẵn sàng dữ liệu và hồ sơ dựa trên thiếu dữ liệu, lệch dữ liệu và mục cần xác nhận.' },
  'compliance-score': { title: 'Điểm tổng quát', body: 'Điểm 0-100 giúp ưu tiên hồ sơ rủi ro, hồ sơ cần kiểm tra và hồ sơ sẵn sàng kê khai.' },
  'compliance-details': { title: 'Chi tiết điểm', body: 'Các thanh chi tiết giải thích điểm bị ảnh hưởng bởi tiêu chí nào và gợi ý màn hình cần xử lý.' },
  'reports-header': { title: 'Hồ sơ tháng', body: 'Báo cáo tháng tổng hợp doanh thu, cảnh báo, thuế tham khảo và trạng thái hồ sơ.' },
  'reports-kpis': { title: 'KPI báo cáo tháng', body: 'Các thẻ tổng hợp doanh thu thuần, cảnh báo, thuế tham khảo và tỷ lệ theo dõi ngưỡng.' },
  'reports-revenue-trend': { title: 'Xu hướng doanh thu', body: 'Biểu đồ giúp xem doanh thu theo tháng từ các dữ liệu đã đối soát.' },
  'reports-ai-summary': { title: 'Phân tích AI và ngưỡng', body: 'Khối tổng hợp phát hiện, mục cần kiểm tra, đề xuất xử lý và nút tải báo cáo nếu có phiên.' },
  'reports-alerts': { title: 'Cảnh báo từ phiên', body: 'Danh sách cảnh báo theo mã, nội dung, mức độ và trạng thái để mở giải thích hoặc chỉnh số.' },
  'yearend-header': { title: 'Hồ sơ cuối năm', body: 'Trang cuối năm tập trung vào checklist và mức sẵn sàng để chốt năm.' },
  'yearend-kpis': { title: 'Tổng quan cuối năm', body: 'Các thẻ tổng hợp doanh thu, giá trị đã ghi nhận và số hồ sơ đã hoàn thành.' },
  'yearend-checklist': { title: 'Checklist hồ sơ cuối năm', body: 'Checklist cho biết mục nào đã xong, mục nào còn thiếu và có thể lọc riêng mục cần làm.' },
  'yearend-readiness': { title: 'Mức sẵn sàng kiểm toán', body: 'Vòng tiến độ thể hiện mức sẵn sàng cuối năm và nút chuyển nhanh tới checklist hoặc kho chứng từ.' },
  'settings-header': { title: 'Cài đặt tài khoản', body: 'Trang cài đặt dùng để quản lý thông tin đăng nhập, ảnh đại diện và bảo mật tài khoản.' },
  'settings-profile': { title: 'Thông tin cá nhân', body: 'Khu vực này hiển thị tên và email đang dùng để nhận diện tài khoản trong hệ thống.' },
  'settings-password': { title: 'Mật khẩu', body: 'Đổi mật khẩu định kỳ để giữ tài khoản an toàn.' },
  'settings-avatar': { title: 'Ảnh đại diện', body: 'Tải ảnh đại diện mới để cập nhật hình ảnh tài khoản.' },
};

function decodeMojibake(text: string) {
  if (!/[ÃÄÂáºá»]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text), (char) => char.charCodeAt(0) & 0xff);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return text;
  }
}

function normalizeSteps(steps: TourStep[]) {
  return steps.map((item) => ({
    ...item,
    title: TOUR_TEXT_OVERRIDES[item.id]?.title ?? decodeMojibake(item.title),
    body: TOUR_TEXT_OVERRIDES[item.id]?.body ?? decodeMojibake(item.body),
  }));
}

function getTourSteps(mode: ProductTourProps['mode'], page: string): TourStep[] {
  if (mode === 'menu') return normalizeSteps(MENU_TOUR_STEPS);
  const pageSteps = PAGE_TOUR_STEPS[page] ?? PAGE_TOUR_STEPS.home;
  if (page === 'home') {
    return normalizeSteps(pageSteps.filter((step) => HOME_TOUR_STEP_IDS.has(step.id)));
  }
  return normalizeSteps(pageSteps);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTargetElement(target: string) {
  return document.querySelector<HTMLElement>(`[data-product-tour="${target}"]`);
}

function getTargetRect(target: string) {
  return getTargetElement(target)?.getBoundingClientRect() ?? null;
}

function tourPosition(rect: DOMRect | null, placement: TourStep['placement']) {
  const width = Math.min(360, window.innerWidth - 32);
  const gap = 14;

  if (!rect) {
    return {
      left: clamp((window.innerWidth - width) / 2, 16, window.innerWidth - width - 16),
      top: clamp(window.innerHeight / 2 - 140, 16, window.innerHeight - 260),
      width,
    };
  }

  if (placement === 'right') {
    return {
      left: clamp(rect.right + gap, 16, window.innerWidth - width - 16),
      top: clamp(rect.top + rect.height / 2 - 110, 16, window.innerHeight - 240),
      width,
    };
  }

  if (placement === 'left') {
    return {
      left: clamp(rect.left - width - gap, 16, window.innerWidth - width - 16),
      top: clamp(rect.top + rect.height / 2 - 110, 16, window.innerHeight - 240),
      width,
    };
  }

  if (placement === 'top') {
    return {
      left: clamp(rect.left + rect.width / 2 - width / 2, 16, window.innerWidth - width - 16),
      top: clamp(rect.top - 230, 16, window.innerHeight - 240),
      width,
    };
  }

  return {
    left: clamp(rect.left + rect.width / 2 - width / 2, 16, window.innerWidth - width - 16),
    top: clamp(rect.bottom + gap, 16, window.innerHeight - 240),
    width,
  };
}

export function shouldAutoOpenProductTour(userId?: string | number | null) {
  try {
    const key = userId ? `${STORAGE_KEY}.${userId}` : STORAGE_KEY;
    return localStorage.getItem(key) !== '1';
  } catch {
    return true;
  }
}

export function markProductTourDismissed(userId?: string | number | null) {
  try {
    const key = userId ? `${STORAGE_KEY}.${userId}` : STORAGE_KEY;
    localStorage.setItem(key, '1');
  } catch {
    // ignore localStorage failures
  }
}

export default function ProductTour({
  isOpen,
  onClose,
  onComplete,
  activePage,
  page,
  mode = 'page',
}: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const navigatedStepRef = useRef<string | null>(null);
  const steps = useMemo(() => getTourSteps(mode, page), [mode, page]);
  const step = steps[stepIndex];

  const updateRect = () => {
    if (!step) return;
    const nextRect = getTargetRect(step.target);
    setTargetRect((current) => nextRect ?? current);
  };

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setTargetRect(null);
      navigatedStepRef.current = null;
      return;
    }
    if (step && activePage !== step.page && navigatedStepRef.current !== step.id) {
      navigatedStepRef.current = step.id;
    }
  }, [activePage, isOpen, step?.id, step?.page]);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'menu') {
        window.dispatchEvent(new Event('scaify.productTour.openSidebar'));
      }
      setStepIndex(0);
      setTargetRect(null);
      navigatedStepRef.current = null;
    }
  }, [isOpen, mode, page]);

  useLayoutEffect(() => {
    if (!isOpen || !step) return;
    if (activePage !== step.page) return;
    window.setTimeout(() => {
      getTargetElement(step.target)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);
    updateRect();
    const timers = [220, 520, 900, 1300].map((delay) => window.setTimeout(updateRect, delay));
    const missingTimer = window.setTimeout(() => {
      if (!getTargetElement(step.target)) {
        setStepIndex((value) => Math.min(value + 1, steps.length - 1));
      }
    }, 1450);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(missingTimer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [activePage, isOpen, stepIndex, step]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') {
        window.setTimeout(
          () => setStepIndex((value) => Math.min(value + 1, steps.length - 1)),
          STEP_CHANGE_DELAY_MS
        );
      }
      if (event.key === 'ArrowLeft') {
        window.setTimeout(
          () => setStepIndex((value) => Math.max(value - 1, 0)),
          STEP_CHANGE_DELAY_MS
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, steps.length]);

  const panelStyle = useMemo(
    () => (step ? tourPosition(targetRect, step.placement) : undefined),
    [step, targetRect]
  );

  if (!isOpen || !step || typeof document === 'undefined') return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const highlight = targetRect
    ? {
        left: targetRect.left - 8,
        top: targetRect.top - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[120]">
        <motion.button
          type="button"
          aria-label={TEXT.closeProductTour}
          className="absolute inset-0"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {highlight && (
          <motion.div
            className="pointer-events-none fixed rounded-xl border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.58),0_18px_50px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.95)]"
            initial={false}
            animate={highlight}
            transition={{ type: 'spring', stiffness: 170, damping: 30, mass: 1 }}
          />
        )}

        <motion.aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-tour-title"
          className="fixed overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl"
          style={panelStyle}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.36, ease: 'easeOut' }}
        >
          <div className="border-b border-outline-variant bg-surface px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Product tour {stepIndex + 1}/{steps.length}
                </p>
                <h2 id="product-tour-title" className="mt-1 font-display text-lg font-bold text-on-surface">
                  {step.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-outline hover:bg-white hover:text-primary"
                aria-label={TEXT.close}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="p-5">
            <p className="text-sm leading-relaxed text-outline">{step.body}</p>
            <div className="mt-5 flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                <div className="flex w-max gap-1.5">
                {steps.map((item, index) => (
                  <span
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all ${
                      index === stepIndex ? 'w-6 bg-primary' : 'w-1.5 bg-outline-variant'
                    }`}
                  />
                ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center rounded-lg border border-outline-variant px-3 py-2 text-sm font-bold text-outline transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {TEXT.cancel}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.setTimeout(
                      () => setStepIndex((value) => Math.max(value - 1, 0)),
                      STEP_CHANGE_DELAY_MS
                    )
                  }
                  disabled={isFirst}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-outline-variant text-outline hover:border-primary/40 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                  aria-label={TEXT.previousStep}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    isLast
                      ? (onComplete?.(), onClose())
                      : window.setTimeout(() => setStepIndex((value) => value + 1), STEP_CHANGE_DELAY_MS)
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary-container"
                >
                  {isLast ? TEXT.finish : TEXT.next}
                  {!isLast && <ChevronRight className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>,
    document.body
  );
}

