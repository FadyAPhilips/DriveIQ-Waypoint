import { apiRequest } from "./client";

export type HelloResponse = {
  message: string;
};

export function fetchHello(): Promise<HelloResponse> {
  return apiRequest<HelloResponse>("/hello");
}
