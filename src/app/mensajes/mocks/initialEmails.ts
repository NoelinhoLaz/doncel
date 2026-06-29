import type { Email } from "@/types/mensajes";

const initialEmails: Email[] = [
  {
    id: "nike",
    senderName: "Nike Store",
    subject: "Select NFL Gear Up to 50% Off",
    time: "6 min",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    color: "color-mix(in srgb, var(--primary-color, #475569) 80%, black)",
    avatarText: "N",
    starred: false,
    contactName: "Nike Store Support",
    contactRole: "Retail Experience Lead",
    contactEmail: "nfl-gear@nike.com",
    contactPhone: "+1 (800) 806-6453",
    companyName: "Nike, Inc.",
    companyLocation: "Beaverton, Oregon",
    companyIndustry: "Sports & Apparel",
    companyFounded: "1964",
    companyEmployees: "79,000+",
    companyRevenue: "$46.7 Billion",
    companyLogoText: "✓",
    companyLogoColor: "color-mix(in srgb, var(--primary-color, #475569) 80%, black)",
    attachments: ["Spring_Collection_Promo.pdf", "NFL_Gear_Discount.xlsx"],
    thread: [
      {
        id: "n-1",
        senderName: "Nike Store Support",
        senderEmail: "nfl-gear@nike.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 80%, black)",
        date: "8:38 am February 28th, 2026",
        body: "Get ready for kickoff with 50% off select jerseys, custom hoodies, and official sidelines merchandise. Offer valid through the weekend only."
      }
    ],
    whatsappThread: [
      {
        id: "nw-1",
        senderName: "Nike Store Support",
        senderRole: "client",
        body: "Hello! We are preparing the logistics for the custom NFL gear order. Can you confirm the final traveler headcount for the flight?",
        time: "11:24 am"
      },
      {
        id: "nw-2",
        senderName: "Walter Sobchak",
        senderRole: "agent",
        body: "Hi! Yes, we have exactly 22 travelers registered under the Salou / Port Aventura group. I will email the list shortly.",
        time: "11:26 am"
      },
      {
        id: "nw-3",
        senderName: "Nike Store Support",
        senderRole: "client",
        body: "Perfect! We will process the group discount code and send it over. Thank you!",
        time: "11:30 am"
      }
    ]
  },
  {
    id: "mcdonalds",
    senderName: "McDonalds",
    subject: "Eat More You Fat Fuck",
    time: "2 hrs",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud...",
    color: "color-mix(in srgb, var(--primary-color, #475569) 60%, black)",
    avatarText: "M",
    starred: false,
    contactName: "Ronald McDonald",
    contactRole: "Chief Happiness Officer",
    contactEmail: "happiness@mcdonalds.com",
    contactPhone: "+1 (800) 244-6227",
    companyName: "McDonald's Corporation",
    companyLocation: "Chicago, Illinois",
    companyIndustry: "Food Services & Franchise",
    companyFounded: "1940",
    companyEmployees: "200,000+",
    companyRevenue: "$23.2 Billion",
    companyLogoText: "M",
    companyLogoColor: "color-mix(in srgb, var(--primary-color, #475569) 60%, black)",
    attachments: ["New_Menu_Upgrades.pdf"],
    thread: [
      {
        id: "m-1",
        senderName: "Ronald McDonald",
        senderEmail: "happiness@mcdonalds.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 60%, black)",
        date: "3:40 pm February 28th, 2026",
        body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. We noticed you haven't ordered your favorite double cheeseburger this week. Here is a 10% coupon to help you get back on track!"
      }
    ],
    whatsappThread: [
      {
        id: "mw-1",
        senderName: "Ronald McDonald",
        senderRole: "client",
        body: "Hey Walter! Just wanted to know if Dunder Mifflin ordered the catering for the quarterly seminar?",
        time: "2:05 pm"
      },
      {
        id: "mw-2",
        senderName: "Walter Sobchak",
        senderRole: "agent",
        body: "Hi Ronald. Yes, Jan Levinson handled the booking. It's scheduled for delivery this Friday at 11:30 am.",
        time: "2:10 pm"
      },
      {
        id: "mw-3",
        senderName: "Ronald McDonald",
        senderRole: "client",
        body: "Awesome. I'll make sure the team has the kitchen ready. See you Friday!",
        time: "2:12 pm"
      }
    ]
  },
  {
    id: "modern-photography",
    senderName: "ModernPhotography",
    subject: "Corporate Photoshoot",
    time: "2 hrs",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation...",
    color: "var(--primary-color, #475569)",
    avatarText: "MP",
    starred: false,
    contactName: "Mollie Lang",
    contactRole: "Client Service Representative",
    contactEmail: "mollie@modernphotos.com",
    contactPhone: "(314) 554-6340",
    companyName: "Modern Photography",
    companyLocation: "St. Louis, Missouri",
    companyIndustry: "Photography & Videography",
    companyFounded: "2004",
    companyEmployees: "20 - 30",
    companyRevenue: "$6 million",
    companyLogoText: "✥",
    companyLogoColor: "var(--primary-color, #475569)",
    attachments: ["Corporate Headshots", "Christmas Party"],
    thread: [
      {
        id: "mp-1",
        senderName: "Mollie Lang",
        senderEmail: "mollie@modernphotos.com",
        avatarColor: "var(--primary-color, #475569)",
        date: "8:44 am February 4th, 2020",
        body: "Corporate Photoshoot. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint."
      },
      {
        id: "mp-2",
        senderName: "Walter Sobchak",
        senderEmail: "walter@sobchak.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 30%, black)",
        date: "6:20 am February 3rd, 2020",
        body: "We need those headshots retouched before Tuesday. The client is highly specific about the contrast ratios and lighting. Please ensure the shadows are appropriately softened."
      },
      {
        id: "mp-3",
        senderName: "Mollie Lang",
        senderEmail: "mollie@modernphotos.com",
        avatarColor: "var(--primary-color, #475569)",
        date: "9:54 am February 2nd, 2020",
        body: "I have uploaded the initial drafts of the photoshoot to Dropbox. Please review the 'Corporate Headshots' and 'Christmas Party' folders below."
      },
      {
        id: "mp-4",
        senderName: "Walter Sobchak",
        senderEmail: "walter@sobchak.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 30%, black)",
        date: "6:20 am February 2nd, 2020",
        body: "Any updates on the corporate photoshoot files? We need them in the St. Louis office as soon as possible."
      },
      {
        id: "mp-5",
        senderName: "Mollie Lang",
        senderEmail: "mollie@modernphotos.com",
        avatarColor: "var(--primary-color, #475569)",
        date: "4:21 pm February 1st, 2020",
        body: "Hi Walter, we are scheduling the shoot for this Friday. I'll send over the logistics and safety guidelines shortly."
      }
    ],
    whatsappThread: [
      {
        id: "mpw-1",
        senderName: "Mollie Lang",
        senderRole: "client",
        body: "Hi Walter! I just uploaded the corporate headshot files to Dropbox. Can you confirm if you can access them?",
        time: "4:20 pm"
      },
      {
        id: "mpw-2",
        senderName: "Walter Sobchak",
        senderRole: "agent",
        body: "Got them! They look absolutely stellar. The team is already working on the album files.",
        time: "4:25 pm"
      },
      {
        id: "mpw-3",
        senderName: "Mollie Lang",
        senderRole: "client",
        body: "Awesome! Let me know if you need any additional crops or specific retouches.",
        time: "4:26 pm"
      },
      {
        id: "mpw-4",
        senderName: "Walter Sobchak",
        senderRole: "agent",
        body: "Will do. Thanks Mollie!",
        time: "4:30 pm"
      },
      {
        id: "mpw-5",
        senderName: "Mollie Lang",
        senderRole: "client",
        body: "Perfect, speak soon! Have a great day.",
        time: "Just now"
      }
    ]
  },
  {
    id: "jan-accounting",
    senderName: "Jan From Accounting",
    subject: "My Famous Meatloaf is Here",
    time: "7 hrs",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam...",
    color: "color-mix(in srgb, var(--primary-color, #475569) 75%, white)",
    avatarText: "J",
    starred: false,
    contactName: "Jan Levinson",
    contactRole: "Head of Corporate Accounting",
    contactEmail: "jlevinson@dundermifflin.com",
    contactPhone: "+1 (570) 555-0192",
    companyName: "Dunder Mifflin Paper Co.",
    companyLocation: "Scranton, Pennsylvania",
    companyIndustry: "Paper & Logistics",
    companyFounded: "1949",
    companyEmployees: "1,000+",
    companyRevenue: "$250 Million",
    companyLogoText: "DM",
    companyLogoColor: "color-mix(in srgb, var(--primary-color, #475569) 75%, white)",
    attachments: ["Meatloaf_Secret_Recipe.docx"],
    thread: [
      {
        id: "j-1",
        senderName: "Jan Levinson",
        senderEmail: "jlevinson@dundermifflin.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 75%, white)",
        date: "10:15 am February 28th, 2026",
        body: "I made my famous meatloaf for the office potluck. It is sitting in the breakroom. Please serve yourself before Michael eats all of it!"
      }
    ],
    whatsappThread: [
      {
        id: "jw-1",
        senderName: "Jan Levinson",
        senderRole: "client",
        body: "Hi Walter! Did you receive the corporate expense sheets for Dunder Mifflin?",
        time: "10:14 am"
      },
      {
        id: "jw-2",
        senderName: "Walter Sobchak",
        senderRole: "agent",
        body: "Yes Jan, they have been logged. I reconciliated the payments with our bank ledger this morning.",
        time: "10:15 am"
      },
      {
        id: "jw-3",
        senderName: "Jan Levinson",
        senderRole: "client",
        body: "Fantastic! Thanks for the quick update. Saved me a ton of paperwork.",
        time: "10:18 am"
      }
    ]
  },
  {
    id: "amazon-delivery",
    senderName: "Amazon Delivery",
    subject: "Your Spy Kids 3 VHS Was Delivered",
    time: "9 hrs",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim...",
    color: "color-mix(in srgb, var(--primary-color, #475569) 45%, white)",
    avatarText: "a",
    starred: false,
    contactName: "Amazon Logistics",
    contactRole: "Delivery Updates Team",
    contactEmail: "shipment-tracking@amazon.com",
    contactPhone: "+1 (888) 280-4331",
    companyName: "Amazon.com, Inc.",
    companyLocation: "Seattle, Washington",
    companyIndustry: "E-Commerce & Technology",
    companyFounded: "1994",
    companyEmployees: "1.5 Million",
    companyRevenue: "$513.9 Billion",
    companyLogoText: "a",
    companyLogoColor: "color-mix(in srgb, var(--primary-color, #475569) 45%, white)",
    attachments: [],
    thread: [
      {
        id: "amz-1",
        senderName: "Amazon Logistics",
        senderEmail: "shipment-tracking@amazon.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 45%, white)",
        date: "8:20 am February 28th, 2026",
        body: "Your order containing 'Spy Kids 3-D: Game Over (VHS)' has been handed directly to a resident at your doorstep. We hope you enjoy the movie!"
      }
    ],
    whatsappThread: [
      {
        id: "aw-1",
        senderName: "Amazon Logistics",
        senderRole: "client",
        body: "Your package containing 'Spy Kids 3-D VHS' has been dispatched from the local depot. Expected arrival by 8:00 pm.",
        time: "7:45 am"
      },
      {
        id: "aw-2",
        senderName: "Amazon Logistics",
        senderRole: "client",
        body: "Update: Package has been delivered at your doorstep and handed directly to a resident.",
        time: "8:20 am"
      }
    ]
  },
  {
    id: "apple-news",
    senderName: "Apple News",
    subject: "Mass Grave Found in Busey's Basement",
    time: "11 hrs",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim...",
    color: "color-mix(in srgb, var(--primary-color, #475569) 85%, black)",
    avatarText: "🍎",
    starred: false,
    contactName: "Apple News Editors",
    contactRole: "Lead Newsroom Curator",
    contactEmail: "news-room@apple.com",
    contactPhone: "+1 (800) 275-2273",
    companyName: "Apple Inc.",
    companyLocation: "Cupertino, California",
    companyIndustry: "Consumer Electronics & Tech",
    companyFounded: "1976",
    companyEmployees: "164,000+",
    companyRevenue: "$394.3 Billion",
    companyLogoText: "",
    companyLogoColor: "color-mix(in srgb, var(--primary-color, #475569) 85%, black)",
    attachments: [],
    thread: [
      {
        id: "apple-1",
        senderName: "Apple News Editors",
        senderEmail: "news-room@apple.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 85%, black)",
        date: "6:15 am February 28th, 2026",
        body: "In a stunning local development, authorities are investigating a peculiar finding in Gary Busey's Hollywood Hills residence. Read the full journalistic piece in the Apple News App."
      }
    ],
    whatsappThread: [
      {
        id: "apw-1",
        senderName: "Apple News Editors",
        senderRole: "client",
        body: "Apple News Daily: Major local updates on the Los Angeles area. Stay tuned for breaking notifications.",
        time: "6:00 am"
      }
    ]
  },
  {
    id: "netflix",
    senderName: "Netflix",
    subject: "Just Added: Busey & Beastiality",
    time: "Yesterday",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...",
    color: "color-mix(in srgb, var(--primary-color, #475569) 70%, black)",
    avatarText: "N",
    starred: false,
    contactName: "Netflix Curation",
    contactRole: "Content Recommendations",
    contactEmail: "info@netflix.com",
    contactPhone: "+1 (866) 579-7172",
    companyName: "Netflix, Inc.",
    companyLocation: "Los Gatos, California",
    companyIndustry: "Entertainment & Streaming",
    companyFounded: "1997",
    companyEmployees: "12,800+",
    companyRevenue: "$31.6 Billion",
    companyLogoText: "N",
    companyLogoColor: "color-mix(in srgb, var(--primary-color, #475569) 70%, black)",
    attachments: [],
    thread: [
      {
        id: "netflix-1",
        senderName: "Netflix Curation",
        senderEmail: "info@netflix.com",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 70%, black)",
        date: "Yesterday, 3:00 pm",
        body: "Because you watched the Gary Busey documentaries, we've unlocked a special category featuring his most eccentric cinematic projects. Explore now."
      }
    ],
    whatsappThread: [
      {
        id: "netw-1",
        senderName: "Netflix Curation",
        senderRole: "client",
        body: "Hey Walter! A new documentary series matching your preferences is now available. Click to watch the trailer.",
        time: "Yesterday"
      }
    ]
  },
  {
    id: "gary-busey",
    senderName: "Gary Busey",
    subject: "Lamb Sacrifice. My Office. Now.",
    time: "Yesterday",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut...",
    color: "color-mix(in srgb, var(--primary-color, #475569) 30%, black)",
    avatarText: "GB",
    starred: false,
    contactName: "Gary Busey",
    contactRole: "Eccentric Icon",
    contactEmail: "gary@busey.org",
    contactPhone: "(555) 666-BUSEY",
    companyName: "Busey Enterprise",
    companyLocation: "Hollywood, California",
    companyIndustry: "Chaotic Art & Entertainment",
    companyFounded: "1944",
    companyEmployees: "1",
    companyRevenue: "Priceless",
    companyLogoText: "GB",
    companyLogoColor: "color-mix(in srgb, var(--primary-color, #475569) 30%, black)",
    attachments: ["Sacrifice_Guidelines.docx"],
    thread: [
      {
        id: "busey-1",
        senderName: "Gary Busey",
        senderEmail: "gary@busey.org",
        avatarColor: "color-mix(in srgb, var(--primary-color, #475569) 30%, black)",
        date: "Yesterday, 11:21 am",
        body: "WE HAVE AN APPOINTMENT WITH DESTINY. BRING THE LAMB. BRING THE OIL. THE SPIRITS ARE DANCING. DON'T BE LATE. MY OFFICE. NOW."
      }
    ],
    whatsappThread: [
      {
        id: "gw-1",
        senderName: "Gary Busey",
        senderRole: "client",
        body: "WALTER. THE STARS HAVE ALIGNED. THE LAMB IS SECURED. COME TO HOLLYWOOD HILLS AT ONCE.",
        time: "Yesterday, 11:20 am"
      }
    ]
  }
];

export default initialEmails;
