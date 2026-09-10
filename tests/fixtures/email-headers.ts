/**
 * Realistic email header fixture for testing
 * Uses example.com domain which is reserved for documentation
 */
export const REALISTIC_EMAIL_HEADER = `Delivered-To: user@example.com
Received: by 2002:a05:6902:1234:0:0:0:0 with SMTP id a1234567890123bcd;
        Mon, 7 Sep 2026 15:30:00 +0000 (UTC)
Received: from mail.example.com (mail.example.com. [192.0.2.1])
        by mx.google.com with SMTP id a1234567890123bcd.2
        for <user@example.com>;
        Mon, 7 Sep 2026 15:30:00 +0000 (UTC)
Return-Path: <sender@example.com>
Received-SPF: pass (google.com: domain of sender@example.com designates 192.0.2.1 as permitted sender) client-ip=192.0.2.1;
Authentication-Results: mx.google.com;
       spf=pass (google.com: domain of sender@example.com designates 192.0.2.1 as permitted sender) smtp.mailfrom=sender@example.com;
       dkim=pass header.i=@example.com header.s=default header.b=ExampleB64String;
       dmarc=pass (p=quarantine sp=quarantine dis=none) header.from=example.com;
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=example.com; s=default;
        h=from:to:subject:date:message-id:in-reply-to:references;
        bh=ExampleBodyHashHere123456789;
        b=ExampleBase64EncodedSignatureHere
From: Sender Name <sender@example.com>
To: recipient@example.com
Subject: Test Email with Full Headers
Date: Mon, 7 Sep 2026 15:30:00 +0000
Message-ID: <example123456789@example.com>
In-Reply-To: <parent@example.com>
References: <root@example.com> <parent@example.com>
Reply-To: reply@example.com
Content-Type: text/plain; charset=UTF-8
MIME-Version: 1.0
User-Agent: Mozilla/5.0 (Example Email Client)
X-Originating-IP: [192.0.2.2]

This is the email body.
`;
