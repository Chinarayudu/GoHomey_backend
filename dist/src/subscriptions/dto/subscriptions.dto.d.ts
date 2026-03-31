export declare class CreatePlanDto {
    name: string;
    goal: string;
    description: string;
    price: number;
    menu_json: any;
}
export declare class CreateSlotDto {
    plan_id: string;
    time_slot: string;
    capacity: number;
}
