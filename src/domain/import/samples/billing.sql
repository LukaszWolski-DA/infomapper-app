USE [billing]
GO
/****** Object:  Table [dbo].[invoice]    Script Date: 21.10.2026 10:12:44 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[invoice](
	[invoice_id] [bigint] IDENTITY(1,1) NOT NULL,
	[invoice_no] [varchar](20) NOT NULL,
	[cust_no] [varchar](20) NOT NULL,
	[issued_on] [date] NOT NULL,
	[amount] [decimal](12, 2) NOT NULL,
	[currency] [char](3) NOT NULL,
	[status] [tinyint] NULL,
	[full_ref]  AS ([invoice_no]+'/'+[currency]),
 CONSTRAINT [PK_invoice] PRIMARY KEY CLUSTERED 
(
	[invoice_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
CREATE TABLE [dbo].[invoice_line](
	[invoice_id] [bigint] NOT NULL,
	[line_no] [int] NOT NULL,
	[item_code] [varchar](30) NOT NULL,
	[qty] [decimal](10, 3) NOT NULL,
	[net_amount] [decimal](12, 2) NOT NULL,
	[note] [nvarchar](max) NULL,
 CONSTRAINT [PK_invoice_line] PRIMARY KEY CLUSTERED ([invoice_id] ASC, [line_no] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_invoice_cust] ON [dbo].[invoice] ([cust_no] ASC)
GO
ALTER TABLE [dbo].[invoice] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[invoice_line]  WITH CHECK ADD  CONSTRAINT [FK_invoice_line_invoice] FOREIGN KEY([invoice_id])
REFERENCES [dbo].[invoice] ([invoice_id])
GO
ALTER TABLE [dbo].[invoice_line] CHECK CONSTRAINT [FK_invoice_line_invoice]
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Invoice header, one row per invoice' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'invoice'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Customer number as in CRM' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'invoice', @level2type=N'COLUMN',@level2name=N'cust_no'
GO
CREATE VIEW [dbo].[v_open_invoices] AS SELECT invoice_id, amount FROM dbo.invoice WHERE status = 1
GO
