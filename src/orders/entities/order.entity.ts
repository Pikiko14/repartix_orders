export enum StatusEnum {
  pending = 'pending',
  in_progress = 'in_progress',
  delivered = 'delivered',
  cancelled = 'cancelled',
  returned = 'returned',
  guide_printed = 'guide-printed',
  guide_news = 'guide-news',
}

export class OrderEntity {
  date: Date;

  scheduled_date: Date;

  status: StatusEnum;

  client: {
    name: string;
    last_name: string;
    address: string;
    phone?: string;
    email?: string;
    dni?: string;
    coords?: {
      lat: number;
      lng: number;
    };
  };

  sender: {
    brand_name: string;
    brand_phone?: string;
    address: {
      address: string;
      complement: string;
      coords: {
        lat: number;
        lng: number;
      };
    };
  };

  products: {
    sku?: string;
    name: string;
    description?: string;
    quantity: number;
    unit_price: string;
    total_price?: string;
    weight?: number;
  }[];

  courier: {
    full_name: string;
    vehicle_type?: string;
    license_plate?: string;
    phone?: string;
  };

  cash_on_delivery?: boolean;

  cash_amount?: string;

  settled_to_sender?: boolean;

  notes?: string;

  payments: {
    methods: string;
    amount: number;
    date: Date;
  }[];

  parent_id?: string;

  order_price: number;

  reference?: string;

  city?: string;
  zone?: {
    name?: string;
    price?: string;
    cod_zone?: string;
  };
  print_guide?: boolean;

  statuses: {
    status: StatusEnum;
    date: Date;
    description: string;
  }[];
}
