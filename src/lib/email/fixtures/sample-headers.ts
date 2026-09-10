export const SAMPLE_EMAIL_HEADERS = `Delivered-To: user@example.com
Received: by 2001:db8::1 with SMTP id a123;
        Mon, 7 Sep 2026 15:30:00 +0000 (UTC)
Received: from mail.example.com (mail.example.com. [192.0.2.1])
        by mx.example.net with ESMTPS id b456
        for <user@example.com>;
        Mon, 7 Sep 2026 15:29:58 +0000 (UTC)
Return-Path: <sender@example.com>
Received-SPF: pass (example.net: domain of sender@example.com designates 192.0.2.1 as permitted sender) client-ip=192.0.2.1;
Authentication-Results: mx.example.net;
       spf=pass smtp.mailfrom=sender@example.com;
       dkim=pass header.d=example.com header.s=default;
       dmarc=pass header.from=example.com;
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=example.com; s=default;
        h=from:to:subject:date:message-id;
        bh=ExampleBodyHash;
        b=ExampleSignature
From: Sender Name <sender@example.com>
To: recipient@example.com
Subject: Sample diagnostic message
Date: Mon, 7 Sep 2026 15:29:50 +0000
Message-ID: <example123@example.com>
Reply-To: reply@example.com
Content-Type: text/plain; charset=UTF-8
MIME-Version: 1.0
User-Agent: Example Mailer
`;
